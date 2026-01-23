import { spawn, ChildProcess } from 'child_process';
import { rgPath } from '@vscode/ripgrep';

import type { Repository } from '../types/repository.js';
import type { TextSearchOptions, TextSearchResult } from '../types/search.js';
import { getRelativePath } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';
import { DEFAULT_SEARCH_TIMEOUT_MS } from '../constants.js';

interface RipgrepMatch {
  type: 'match';
  data: {
    path: { text: string };
    lines: { text: string };
    line_number: number;
    absolute_offset: number;
    submatches: Array<{
      match: { text: string };
      start: number;
      end: number;
    }>;
  };
}

type RipgrepMessage = RipgrepMatch | { type: 'begin' | 'end' | 'summary' | 'context' };

export class TextSearchEngine {
  private timeout: number;

  constructor(timeout: number = DEFAULT_SEARCH_TIMEOUT_MS) {
    this.timeout = timeout;
  }

  async search(
    options: TextSearchOptions,
    repositories: Repository[]
  ): Promise<TextSearchResult[]> {
    const results: TextSearchResult[] = [];
    const maxPerRepo = options.maxResults
      ? Math.ceil(options.maxResults / repositories.length)
      : 100;

    const searchPromises = repositories.map((repo) =>
      this.searchInRepo(repo, options, maxPerRepo)
    );

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

  private async searchInRepo(
    repo: Repository,
    options: TextSearchOptions,
    maxResults: number
  ): Promise<TextSearchResult[]> {
    return new Promise((resolve) => {
      const args = this.buildRgArgs(options, maxResults);
      args.push(repo.path);

      logger.debug('Running ripgrep', { args, repo: repo.path });

      let ripgrepProcess: ChildProcess;
      try {
        ripgrepProcess = spawn(rgPath, args, {
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch (error) {
        logger.error('Failed to spawn ripgrep', { error });
        resolve([]);
        return;
      }

      const results: TextSearchResult[] = [];
      let buffer = '';
      let timedOut = false;
      let resolved = false;

      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          ripgrepProcess.stdout?.removeAllListeners();
          ripgrepProcess.stderr?.removeAllListeners();
          ripgrepProcess.removeAllListeners();
        }
      };

      // Set timeout with SIGKILL fallback
      const timeoutId = setTimeout(() => {
        timedOut = true;
        ripgrepProcess.kill('SIGTERM');

        // SIGKILL fallback if SIGTERM doesn't work
        setTimeout(() => {
          if (!resolved) {
            ripgrepProcess.kill('SIGKILL');
          }
        }, 1000);

        logger.warn('Ripgrep search timed out', { repo: repo.path, timeout: this.timeout });
        cleanup();
        resolve(results);
      }, this.timeout);

      ripgrepProcess.stdout?.on('data', (data: Buffer) => {
        if (timedOut || resolved) return;

        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const message: RipgrepMessage = JSON.parse(line);

            if (message.type === 'match') {
              const match = message as RipgrepMatch;
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
          } catch (error) {
            logger.debug('Failed to parse ripgrep JSON', {
              line: line.slice(0, 100),
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      });

      ripgrepProcess.stderr?.on('data', (data: Buffer) => {
        const message = data.toString();
        // Only log actual errors, not "no matches found" type messages
        if (message.includes('error') || message.includes('Error')) {
          logger.debug('Ripgrep stderr', { data: message });
        }
      });

      ripgrepProcess.on('close', (code) => {
        clearTimeout(timeoutId);
        if (!resolved) {
          logger.debug('Ripgrep completed', { code, resultCount: results.length, timedOut });
          cleanup();
          resolve(results);
        }
      });

      ripgrepProcess.on('error', (error) => {
        clearTimeout(timeoutId);
        if (!resolved) {
          logger.error('Ripgrep error', { error });
          cleanup();
          resolve([]);
        }
      });
    });
  }

  private buildRgArgs(options: TextSearchOptions, maxResults: number): string[] {
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
