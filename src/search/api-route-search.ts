import { parse, type SgNode } from '@ast-grep/napi';
import fg from 'fast-glob';
import { readFile } from 'fs/promises';

import type { Repository } from '../types/repository.js';
import type { APIRoute, APIRouteSearchOptions } from '../types/symbols.js';
import { getRelativePath } from '../utils/path-utils.js';
import { getLanguageFromExtension, SupportedLanguage } from '../constants.js';
import { logger } from '../utils/logger.js';

const API_ROUTE_IGNORE_PATTERNS = [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/*.test.*',
    '**/*.spec.*',
    '**/*.min.js',
];

export class APIRouteSearchEngine {
    /**
     * Search for API route definitions across multiple repositories
     */
    async search(options: APIRouteSearchOptions, repositories: Repository[]): Promise<APIRoute[]> {
        const allResults: APIRoute[] = [];
        const maxResults = options.maxResults || 500;

        for (const repo of repositories) {
            try {
                const routes = await this.searchInRepo(repo, options, maxResults);
                allResults.push(...routes);

                if (allResults.length >= maxResults) {
                    break;
                }
            } catch (error) {
                logger.error('Error searching for API routes in repository', { repo: repo.path, error });
                // Continue with other repositories
            }
        }

        return allResults.slice(0, maxResults);
    }

    private async searchInRepo(
        repo: Repository,
        options: APIRouteSearchOptions,
        maxResults: number
    ): Promise<APIRoute[]> {
        const results: APIRoute[] = [];

        // Search for JavaScript/TypeScript and PHP files
        const globPatterns = ['**/*.{ts,js,mjs,cjs,php}'];

        const files = await fg(globPatterns, {
            cwd: repo.path,
            ignore: API_ROUTE_IGNORE_PATTERNS,
            absolute: true,
            onlyFiles: true,
        });

        for (const filePath of files) {
            if (results.length >= maxResults) break;

            const routes = await this.findRoutesInFile(filePath, repo, options);
            results.push(...routes);
        }

        return results.slice(0, maxResults);
    }

    private async findRoutesInFile(
        filePath: string,
        repo: Repository,
        options: APIRouteSearchOptions
    ): Promise<APIRoute[]> {
        const routes: APIRoute[] = [];

        try {
            const content = await readFile(filePath, 'utf-8');
            const ext = filePath.substring(filePath.lastIndexOf('.'));
            const language = getLanguageFromExtension(ext);

            if (!language || ![SupportedLanguage.JavaScript, SupportedLanguage.TypeScript, SupportedLanguage.PHP].includes(language)) {
                return routes;
            }

            // Adjust language key for ast-grep if needed (ast-grep usually expects 'php')
            const langKey = (language === SupportedLanguage.JavaScript || language === SupportedLanguage.TypeScript) ? language : SupportedLanguage.PHP;

            let root;
            try {
                root = parse(langKey as any, content);
            } catch (e) {
                // Should only happen if language not supported by current ast-grep build
                return routes;
            }

            const rootNode = root.root();

            if (langKey === SupportedLanguage.PHP) {
                routes.push(...this.findLaravelRoutes(rootNode, filePath, repo, options));
            } else {
                // Express routes: app.get(), router.post(), etc.
                routes.push(...this.findExpressRoutes(rootNode, filePath, repo, options));

                // Fastify routes: fastify.get(), app.route()
                routes.push(...this.findFastifyRoutes(rootNode, filePath, repo, options));

                // NestJS decorators: @Get(), @Post(), etc.
                routes.push(...this.findNestJSRoutes(rootNode, content, filePath, repo, options));
            }

        } catch (error) {
            logger.debug('Error parsing file for API routes', { filePath, error });
        }

        return routes;
    }

    /**
     * Find Laravel (PHP) routes: Route::get('/path', ...)
     */
    private findLaravelRoutes(
        root: SgNode,
        filePath: string,
        repo: Repository,
        options: APIRouteSearchOptions
    ): APIRoute[] {
        const routes: APIRoute[] = [];

        // Laravel Facade patterns
        const patterns = [
            'Route::get($PATH, $$$)',
            'Route::post($PATH, $$$)',
            'Route::put($PATH, $$$)',
            'Route::delete($PATH, $$$)',
            'Route::patch($PATH, $$$)',
            'Route::any($PATH, $$$)',
            'Route::match($METHODS, $PATH, $$$)',
        ];

        for (const pattern of patterns) {
            const matches = root.findAll(pattern);

            for (const match of matches) {
                try {
                    const text = match.text();
                    let method = 'GET';
                    let path = '/';

                    // Extract Method
                    const methodMatch = text.match(/Route::(\w+)/);
                    if (methodMatch) {
                        method = methodMatch[1].toUpperCase();
                    }

                    // Extract Path
                    // $PATH captures the first argument
                    const args = match.getMatch('PATH');
                    if (args) {
                        const pathText = args.text();
                        // Strip quotes ('/', "/foo")
                        path = pathText.replace(/^['"]|['"]$/g, '');
                    }

                    // Apply filters
                    if (options.method && method !== 'ANY' && method !== 'MATCH' && method !== options.method.toUpperCase()) {
                        continue;
                    }
                    if (options.pathPattern && !path.includes(options.pathPattern)) {
                        continue;
                    }
                    if (options.framework && options.framework !== 'laravel') {
                        continue;
                    }

                    // Extract Handler
                    // Often formatted as [Controller::class, 'method'] or 'Controller@method' or function() {}
                    let handler = 'closure';
                    const fullText = match.text();

                    if (fullText.includes('::class')) {
                        const controllerMatch = fullText.match(/\[([\w\\]+)::class,\s*['"](\w+)['"]/);
                        if (controllerMatch) {
                            handler = `${controllerMatch[1]}@${controllerMatch[2]}`;
                        } else {
                            // Try simpler capture
                            const classMatch = fullText.match(/([\w\\]+)::class/);
                            if (classMatch) handler = classMatch[1];
                        }
                    } else if (fullText.includes('@')) {
                        // String style 'Controller@method'
                        const strMatch = fullText.match(/['"]([\w\\]+@\w+)['"]/);
                        if (strMatch) handler = strMatch[1];
                    }

                    const range = match.range();
                    const lineNumber = range.start.line + 1;

                    routes.push({
                        repository: repo.id,
                        repositoryAlias: repo.alias,
                        method,
                        path,
                        handler,
                        filePath,
                        relativePath: getRelativePath(repo.path, filePath),
                        lineNumber,
                        framework: 'laravel',
                        parameters: this.extractPathParameters(path),
                    });

                } catch (error) {
                    logger.debug('Error processing Laravel route match', { error });
                }
            }
        }

        return routes;
    }

    /**
     * Find Express.js routes: app.get('/path', handler)
     */
    private findExpressRoutes(
        root: SgNode,
        filePath: string,
        repo: Repository,
        options: APIRouteSearchOptions
    ): APIRoute[] {
        const routes: APIRoute[] = [];

        const patterns = [
            '$APP.get($PATH, $$$)',
            '$APP.post($PATH, $$$)',
            '$APP.put($PATH, $$$)',
            '$APP.delete($PATH, $$$)',
            '$APP.patch($PATH, $$$)',
            '$APP.all($PATH, $$$)',
            '$ROUTER.route($PATH).get($$$)',
            '$ROUTER.route($PATH).post($$$)',
        ];

        for (const pattern of patterns) {
            const matches = root.findAll(pattern);

            for (const match of matches) {
                try {
                    const text = match.text();
                    const method = this.extractMethod(text);
                    const path = this.extractPath(match);
                    const handler = this.extractHandler(match);

                    // Apply filters
                    if (options.method && method.toUpperCase() !== options.method.toUpperCase()) {
                        continue;
                    }
                    if (options.pathPattern && !path.includes(options.pathPattern)) {
                        continue;
                    }
                    if (options.framework && options.framework !== 'express') {
                        continue;
                    }

                    const range = match.range();
                    const lineNumber = range.start.line + 1;

                    routes.push({
                        repository: repo.id,
                        repositoryAlias: repo.alias,
                        method: method.toUpperCase(),
                        path,
                        handler,
                        filePath,
                        relativePath: getRelativePath(repo.path, filePath),
                        lineNumber,
                        framework: 'express',
                        parameters: this.extractPathParameters(path),
                    });
                } catch (error) {
                    logger.debug('Error processing Express route match', { error });
                }
            }
        }

        return routes;
    }

    /**
     * Find Fastify routes: fastify.get('/path', handler)
     */
    private findFastifyRoutes(
        root: SgNode,
        filePath: string,
        repo: Repository,
        options: APIRouteSearchOptions
    ): APIRoute[] {
        const routes: APIRoute[] = [];

        const patterns = [
            '$APP.get($PATH, $$$)',
            '$APP.post($PATH, $$$)',
            '$APP.put($PATH, $$$)',
            '$APP.delete($PATH, $$$)',
        ];

        for (const pattern of patterns) {
            const matches = root.findAll(pattern);

            for (const match of matches) {
                try {
                    const text = match.text();

                    // Check if it's Fastify (not Express)
                    if (!text.includes('fastify') && !filePath.includes('fastify')) {
                        continue;
                    }

                    const method = this.extractMethod(text);
                    const path = this.extractPath(match);
                    const handler = this.extractHandler(match);

                    if (options.method && method.toUpperCase() !== options.method.toUpperCase()) {
                        continue;
                    }
                    if (options.pathPattern && !path.includes(options.pathPattern)) {
                        continue;
                    }
                    if (options.framework && options.framework !== 'fastify') {
                        continue;
                    }

                    const range = match.range();
                    const lineNumber = range.start.line + 1;

                    routes.push({
                        repository: repo.id,
                        repositoryAlias: repo.alias,
                        method: method.toUpperCase(),
                        path,
                        handler,
                        filePath,
                        relativePath: getRelativePath(repo.path, filePath),
                        lineNumber,
                        framework: 'fastify',
                        parameters: this.extractPathParameters(path),
                    });
                } catch (error) {
                    logger.debug('Error processing Fastify route match', { error });
                }
            }
        }

        return routes;
    }

    /**
     * Find NestJS routes: @Get(), @Post() decorators
     */
    private findNestJSRoutes(
        root: SgNode,
        content: string,
        filePath: string,
        repo: Repository,
        options: APIRouteSearchOptions
    ): APIRoute[] {
        const routes: APIRoute[] = [];
        const lines = content.split('\n');

        // Pattern for NestJS decorators
        const decoratorPatterns = {
            '@Get($$$)': 'GET',
            '@Post($$$)': 'POST',
            '@Put($$$)': 'PUT',
            '@Delete($$$)': 'DELETE',
            '@Patch($$$)': 'PATCH',
        };

        for (const [pattern, method] of Object.entries(decoratorPatterns)) {
            const matches = root.findAll(pattern);

            for (const match of matches) {
                try {
                    // Get the decorator text
                    const decoratorText = match.text();
                    let path = '/';

                    // Extract path from decorator: @Get('users/:id')
                    const pathMatch = decoratorText.match(/@\w+\(['"`]([^'"`]+)['"`]\)/);
                    if (pathMatch) {
                        path = pathMatch[1];
                    }

                    // Apply filters
                    if (options.method && method !== options.method.toUpperCase()) {
                        continue;
                    }
                    if (options.pathPattern && !path.includes(options.pathPattern)) {
                        continue;
                    }
                    if (options.framework && options.framework !== 'nestjs') {
                        continue;
                    }

                    // Find the method below the decorator
                    const range = match.range();
                    const lineNumber = range.start.line + 1;
                    const methodLine = lines[lineNumber] || '';
                    const handlerMatch = methodLine.match(/(\w+)\s*\(/);
                    const handler = handlerMatch ? handlerMatch[1] : 'unknown';

                    routes.push({
                        repository: repo.id,
                        repositoryAlias: repo.alias,
                        method,
                        path,
                        handler,
                        filePath,
                        relativePath: getRelativePath(repo.path, filePath),
                        lineNumber,
                        framework: 'nestjs',
                        parameters: this.extractPathParameters(path),
                    });
                } catch (error) {
                    logger.debug('Error processing NestJS route match', { error });
                }
            }
        }

        return routes;
    }

    private extractMethod(text: string): string {
        // Extract method from pattern like app.get() or @Get()
        const methodMatch = text.match(/\.(get|post|put|delete|patch|all)\(/i);
        if (methodMatch) {
            return methodMatch[1];
        }

        const decoratorMatch = text.match(/@(Get|Post|Put|Delete|Patch)/i);
        if (decoratorMatch) {
            return decoratorMatch[1];
        }

        return 'GET';
    }

    private extractPath(match: SgNode): string {
        try {
            // Try to find the path argument (first string literal)
            const children = match.children();
            for (const child of children) {
                const text = child.text();
                // Match string literals
                if (text.startsWith("'") || text.startsWith('"') || text.startsWith('`')) {
                    return text.slice(1, -1); // Remove quotes
                }
            }
        } catch (error) {
            logger.debug('Error extracting path', { error });
        }
        return '/';
    }

    private extractHandler(match: SgNode): string {
        try {
            const text = match.text();
            // Extract function name or 'handler'
            const handlerMatch = text.match(/,\s*(\w+)\s*[,)]/);
            if (handlerMatch) {
                return handlerMatch[1];
            }

            // Check for inline function
            if (text.includes('=>') || text.includes('function')) {
                return 'inline';
            }
        } catch (error) {
            logger.debug('Error extracting handler', { error });
        }
        return 'unknown';
    }

    private extractPathParameters(path: string): { path: string[]; query: string[]; body?: string } {
        const pathParams: string[] = [];
        const queryParams: string[] = [];

        // Extract :param style parameters
        const paramMatches = path.matchAll(/:(\w+)/g);
        for (const match of paramMatches) {
            pathParams.push(match[1]);
        }

        // Extract {param} style parameters (Fastify)
        const braceMatches = path.matchAll(/\{(\w+)\}/g);
        for (const match of braceMatches) {
            pathParams.push(match[1]);
        }

        return { path: pathParams, query: queryParams };
    }
}
