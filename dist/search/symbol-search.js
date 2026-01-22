import { parse } from '@ast-grep/napi';
import { readFile } from 'fs/promises';
import fg from 'fast-glob';
import { getLangFromFile, getLangNameFromFile, getSupportedExtensions } from '../parsers/language-registry.js';
import { LANGUAGE_PATTERNS } from '../parsers/patterns/index.js';
import { getRelativePath } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';
import { SYMBOL_SEARCH_IGNORE_PATTERNS } from '../constants.js';
export class SymbolSearchEngine {
    async search(options, repositories) {
        const results = [];
        const maxPerRepo = options.maxResults
            ? Math.ceil(options.maxResults / repositories.length)
            : 500;
        for (const repo of repositories) {
            try {
                const repoResults = await this.searchInRepo(repo, options, maxPerRepo);
                results.push(...repoResults);
                if (options.maxResults && results.length >= options.maxResults) {
                    break;
                }
            }
            catch (error) {
                logger.error('Error searching repository', { repo: repo.path, error });
            }
        }
        if (options.maxResults && results.length > options.maxResults) {
            return results.slice(0, options.maxResults);
        }
        return results;
    }
    async searchInRepo(repo, options, maxResults) {
        const results = [];
        const extensions = options.language
            ? this.getExtensionsForLanguage(options.language)
            : getSupportedExtensions();
        const globPatterns = extensions.map((ext) => `**/*${ext}`);
        const files = await fg(globPatterns, {
            cwd: repo.path,
            ignore: SYMBOL_SEARCH_IGNORE_PATTERNS,
            absolute: true,
            onlyFiles: true,
        });
        for (const filePath of files) {
            if (results.length >= maxResults)
                break;
            try {
                const fileResults = await this.searchInFile(repo, filePath, options);
                results.push(...fileResults);
            }
            catch (error) {
                logger.debug('Error parsing file', { filePath, error });
            }
        }
        return results;
    }
    async searchInFile(repo, filePath, options) {
        const results = [];
        const lang = getLangFromFile(filePath);
        const langName = getLangNameFromFile(filePath);
        if (!lang || !langName)
            return results;
        const content = await readFile(filePath, 'utf-8');
        const languagePatterns = LANGUAGE_PATTERNS[langName];
        if (!languagePatterns)
            return results;
        const patterns = languagePatterns.patterns[options.kind] || [];
        // Also search arrow functions for function kind
        const allPatterns = options.kind === 'function' && languagePatterns.arrowFunctions
            ? [...patterns, ...languagePatterns.arrowFunctions]
            : patterns;
        if (allPatterns.length === 0)
            return results;
        // Parse AST once for all patterns (performance fix)
        let ast;
        try {
            ast = parse(lang, content);
        }
        catch (error) {
            logger.debug('Failed to parse file', { filePath, error });
            return results;
        }
        const root = ast.root();
        // Pre-split lines for export checking (performance fix)
        const lines = content.split('\n');
        // Track seen symbols to avoid duplicates
        const seenSymbols = new Set();
        for (const pattern of allPatterns) {
            try {
                const matches = root.findAll(pattern);
                for (const match of matches) {
                    const nameNode = match.getMatch('NAME');
                    const name = nameNode?.text() || 'anonymous';
                    const range = match.range();
                    // Create unique key for deduplication
                    const symbolKey = `${name}:${range.start.line}`;
                    if (seenSymbols.has(symbolKey)) {
                        continue;
                    }
                    // Apply name filter
                    if (options.name && !this.matchesName(name, options.name)) {
                        continue;
                    }
                    // Check if exported using pre-split lines
                    const exported = this.isExportedFromLines(lines, range.start.line);
                    // Apply exportedOnly filter
                    if (options.exportedOnly && !exported) {
                        continue;
                    }
                    seenSymbols.add(symbolKey);
                    const signature = this.extractSignature(match.text(), options.kind);
                    results.push({
                        repository: repo.id,
                        repositoryAlias: repo.alias,
                        filePath,
                        relativePath: getRelativePath(repo.path, filePath),
                        name,
                        kind: options.kind,
                        startLine: range.start.line + 1,
                        endLine: range.end.line + 1,
                        signature,
                        exported,
                    });
                }
            }
            catch (error) {
                logger.debug('Pattern matching error', { pattern, error });
            }
        }
        return results;
    }
    matchesName(name, pattern) {
        if (pattern.includes('*')) {
            const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$', 'i');
            return regex.test(name);
        }
        return name.toLowerCase().includes(pattern.toLowerCase());
    }
    /**
     * Check if a symbol is exported using pre-split lines array
     */
    isExportedFromLines(lines, line) {
        if (line < 0 || line >= lines.length)
            return false;
        const lineContent = lines[line];
        return lineContent.trimStart().startsWith('export');
    }
    extractSignature(text, kind) {
        const lines = text.split('\n');
        const firstLine = lines[0];
        switch (kind) {
            case 'function':
            case 'method':
                // Get just the function declaration without body
                const funcMatch = firstLine.match(/^.*?\([^)]*\)(?:\s*:\s*[^{]+)?/);
                return funcMatch ? funcMatch[0].trim() : firstLine.replace('{', '').trim();
            case 'class':
            case 'interface':
                // Get class/interface declaration
                const classMatch = firstLine.match(/^(export\s+)?(abstract\s+)?(class|interface)\s+\w+[^{]*/);
                return classMatch ? classMatch[0].trim() : firstLine.replace('{', '').trim();
            case 'type':
                // Get full type definition (first line or until semicolon)
                return firstLine.trim();
            default:
                return firstLine.trim();
        }
    }
    getExtensionsForLanguage(language) {
        const langMap = {
            typescript: ['.ts', '.tsx'],
            javascript: ['.js', '.jsx', '.mjs', '.cjs'],
            ts: ['.ts', '.tsx'],
            js: ['.js', '.jsx', '.mjs', '.cjs'],
        };
        return langMap[language.toLowerCase()] || getSupportedExtensions();
    }
}
//# sourceMappingURL=symbol-search.js.map