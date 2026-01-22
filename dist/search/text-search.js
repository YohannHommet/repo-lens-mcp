import { spawn } from 'child_process';
import { rgPath } from '@vscode/ripgrep';
import { getRelativePath } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';
import { DEFAULT_SEARCH_TIMEOUT_MS } from '../constants.js';
export class TextSearchEngine {
    timeout;
    constructor(timeout = DEFAULT_SEARCH_TIMEOUT_MS) {
        this.timeout = timeout;
    }
    async search(options, repositories) {
        const results = [];
        const maxPerRepo = options.maxResults
            ? Math.ceil(options.maxResults / repositories.length)
            : 100;
        const searchPromises = repositories.map((repo) => this.searchInRepo(repo, options, maxPerRepo));
        const repoResults = await Promise.all(searchPromises);
        for (const repoResult of repoResults) {
            results.push(...repoResult);
        }
        // Trim to maxResults if specified
        if (options.maxResults && results.length > options.maxResults) {
            return results.slice(0, options.maxResults);
        }
        return results;
    }
    async searchInRepo(repo, options, maxResults) {
        return new Promise((resolve) => {
            const args = this.buildRgArgs(options, maxResults);
            args.push(repo.path);
            logger.debug('Running ripgrep', { args, repo: repo.path });
            let rg;
            try {
                rg = spawn(rgPath, args, {
                    stdio: ['ignore', 'pipe', 'pipe'],
                });
            }
            catch (error) {
                logger.error('Failed to spawn ripgrep', { error });
                resolve([]);
                return;
            }
            const results = [];
            let buffer = '';
            let timedOut = false;
            // Set timeout to prevent hanging
            const timeoutId = setTimeout(() => {
                timedOut = true;
                rg.kill('SIGTERM');
                logger.warn('Ripgrep search timed out', { repo: repo.path, timeout: this.timeout });
            }, this.timeout);
            rg.stdout?.on('data', (data) => {
                if (timedOut)
                    return;
                buffer += data.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (!line.trim())
                        continue;
                    try {
                        const message = JSON.parse(line);
                        if (message.type === 'match') {
                            const match = message;
                            const filePath = match.data.path.text;
                            results.push({
                                repository: repo.id,
                                repositoryAlias: repo.alias,
                                filePath,
                                relativePath: getRelativePath(repo.path, filePath),
                                lineNumber: match.data.line_number,
                                columnNumber: match.data.submatches[0]?.start || 0,
                                lineContent: match.data.lines.text.trimEnd(),
                                beforeContext: [],
                                afterContext: [],
                            });
                        }
                        // Note: Context lines are not processed in this simplified version
                        // Implementing full context support would require tracking context messages
                        // and associating them with their corresponding match messages
                    }
                    catch {
                        // Invalid JSON line, skip
                    }
                }
            });
            rg.stderr?.on('data', (data) => {
                const message = data.toString();
                // Only log actual errors, not "no matches found" type messages
                if (message.includes('error') || message.includes('Error')) {
                    logger.debug('Ripgrep stderr', { data: message });
                }
            });
            rg.on('close', (code) => {
                clearTimeout(timeoutId);
                logger.debug('Ripgrep completed', { code, resultCount: results.length, timedOut });
                resolve(results);
            });
            rg.on('error', (error) => {
                clearTimeout(timeoutId);
                logger.error('Ripgrep error', { error });
                resolve([]);
            });
        });
    }
    buildRgArgs(options, maxResults) {
        const args = [
            '--json',
            '--line-number',
            '--column',
            '--no-heading',
            '--hidden',
            '--glob',
            '!.git',
            // Ignore common large directories
            '--glob',
            '!node_modules',
            '--glob',
            '!.git',
            '--glob',
            '!vendor',
            '--glob',
            '!dist',
            '--glob',
            '!build',
        ];
        if (!options.caseSensitive) {
            args.push('--ignore-case');
        }
        if (options.wholeWord) {
            args.push('--word-regexp');
        }
        if (options.glob) {
            args.push('--glob', options.glob);
        }
        // Note: Using --max-filesize to skip very large files
        args.push('--max-filesize', '10M');
        // Limit matches per file to avoid overwhelming results from single files
        args.push('--max-count', Math.min(maxResults, 100).toString());
        args.push('--', options.pattern);
        return args;
    }
}
//# sourceMappingURL=text-search.js.map