import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { RepositoryManager } from '../core/repository-manager.js';
import { TextSearchEngine } from '../search/text-search.js';
import { SearchCache } from '../utils/cache.js';
import { ServerConfig } from '../config/types.js';

/**
 * Validate search pattern to prevent ReDoS (Regular Expression Denial of Service)
 */
function validateSearchPattern(pattern: string): void {
  // Max length check
  if (pattern.length > 200) {
    throw new Error('Search pattern too long (max 200 characters)');
  }

  // Check for evil regex patterns (simple heuristic)
  // Avoid nested quantifiers like (a+)+
  const evilRegex = /(\+|\*)\1/;
  if (evilRegex.test(pattern)) {
    throw new Error('Potential ReDoS pattern detected (nested quantifiers)');
  }
}

export function registerSearchTools(
  server: McpServer,
  repoManager: RepositoryManager,
  textSearch: TextSearchEngine,
  searchCache: SearchCache<any>,
  config: ServerConfig
) {
  server.tool(
    'search_text',
    'Search for text pattern across all registered repositories using ripgrep',
    {
      pattern: z.string().describe('Search pattern (supports regex)'),
      repos: z
        .array(z.string())
        .optional()
        .describe('Repository identifiers to search (paths or aliases). Searches all if not specified.'),
      glob: z.string().optional().describe("File glob pattern (e.g., '*.ts', '**/*.{js,jsx}')"),
      caseSensitive: z.boolean().optional().describe('Case-sensitive search (default: false)'),
      wholeWord: z.boolean().optional().describe('Match whole words only (default: false)'),
      maxResults: z.number().optional().describe('Maximum results (default: 100)'),
    },
    async ({ pattern, repos, glob, caseSensitive, wholeWord, maxResults }) => {
      try {
        // Validate pattern to prevent ReDoS
        validateSearchPattern(pattern);

        const repositories = repoManager.resolveIdentifiers(repos);

        if (repositories.length === 0) {
          return {
            content: [{ type: 'text', text: 'No repositories found. Register repositories first.' }],
            isError: true,
          };
        }

        // Check cache
        const cacheKey = searchCache.generateKey('text', {
          pattern,
          repos: repositories.map((r) => r.id).sort(),
          glob,
          caseSensitive,
          wholeWord,
          maxResults,
        });

        if (config.cacheEnabled) {
          const cached = searchCache.get(cacheKey);
          if (cached) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      totalFound: (cached as any[]).length,
                      results: cached,
                      cached: true,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }
        }

        const results = await textSearch.search(
          {
            pattern,
            glob,
            caseSensitive: caseSensitive ?? false,
            wholeWord: wholeWord ?? false,
            maxResults: maxResults ?? 100,
          },
          repositories
        );

        if (config.cacheEnabled) {
          searchCache.set(cacheKey, results);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  totalMatches: results.length,
                  results: results.map((r) => ({
                    repository: r.repositoryAlias || r.repository,
                    file: r.relativePath,
                    line: r.lineNumber,
                    column: r.columnNumber,
                    content: r.lineContent,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );
}
