import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ServerConfig } from '../config/types.js'
import type { RepositoryManager } from '../core/repository-manager.js'
import type { TextSearchEngine } from '../search/text-search.js'
import type { SearchCache } from '../utils/cache.js'
import { z } from 'zod'
import { logger } from '../utils/logger.js'
import { getLanguageForFile } from '../utils/path-utils.js'
import { splitCommaSeparated } from '../utils/string-utils.js'

/**
 * Helper to format search results as Markdown
 */
function formatSearchResults(results: any[], pattern: string, isCached: boolean): string {
  if (results.length === 0) {
    return `No matches found for "${pattern}"`
  }

  let output = `## Search Results for "${pattern}"${isCached ? ' (cached)' : ''}\n`
  output += `Found ${results.length} matches across ${new Set(results.map(r => r.repositoryAlias || r.repository)).size} repositories.\n\n`

  // Group results by file
  const grouped = results.reduce((acc: any, r: any) => {
    const key = `${r.repositoryAlias || r.repository}:${r.relativePath}`
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(r)
    return acc
  }, {})

  for (const [fileKey, matches] of Object.entries(grouped)) {
    const [repo, path] = fileKey.split(':')
    const lang = getLanguageForFile(path)
    output += `### ${repo}:${path}\n`
    output += `\`\`\`${lang}\n`
    for (const m of (matches as any[])) {
      output += `${String(m.lineNumber).padStart(4)}: ${m.lineContent}\n`
    }
    output += `\`\`\`\n\n`
  }

  return output
}

/**
 * Validate search pattern to prevent ReDoS (Regular Expression Denial of Service)
 */
function validateSearchPattern(pattern: string): void {
  // Max length check
  if (pattern.length > 200) {
    throw new Error('Search pattern too long (max 200 characters)')
  }

  // Check for evil regex patterns (simple heuristic)
  // Avoid nested quantifiers like (a+)+
  const evilRegex = /(\+|\*)\1/
  if (evilRegex.test(pattern)) {
    throw new Error('Potential ReDoS pattern detected (nested quantifiers)')
  }
}

export function registerSearchTools(
  server: McpServer,
  repoManager: RepositoryManager,
  textSearch: TextSearchEngine,
  searchCache: SearchCache<any>,
  config: ServerConfig,
) {
  server.tool(
    'search_text',
    'Search for text pattern across all registered repositories using ripgrep',
    {
      pattern: z.string().describe('Search pattern (supports regex)'),
      repoFilter: z
        .string()
        .optional()
        .describe('Repository aliases or paths to search (comma-separated). Searches all if not specified.'),
      glob: z.string().optional().describe('File glob pattern (e.g., \'*.ts\', \'**/*.{js,jsx}\')'),
      caseSensitive: z.boolean().optional().describe('Case-sensitive search (default: false)'),
      wholeWord: z.boolean().optional().describe('Match whole words only (default: false)'),
      maxResults: z.number().optional().describe('Maximum results (default: 100)'),
    },
    async ({ pattern, repoFilter, glob, caseSensitive, wholeWord, maxResults }) => {
      logger.debug('Tool search_text called', { pattern, repoFilter, glob })
      try {
        // Validate pattern to prevent ReDoS
        validateSearchPattern(pattern)

        const repos = splitCommaSeparated(repoFilter)
        const repositories = repoManager.resolveIdentifiers(repos)

        if (repositories.length === 0) {
          return {
            content: [{ type: 'text', text: 'No repositories found. Register repositories first.' }],
            isError: true,
          }
        }

        // Check cache
        const cacheKey = searchCache.generateKey('text', {
          pattern,
          repos: repositories.map(r => r.id).sort(),
          glob,
          caseSensitive,
          wholeWord,
          maxResults,
        })

        if (config.cacheEnabled) {
          const cached = searchCache.get(cacheKey)
          if (cached) {
            const results = cached as any[]
            return {
              content: [
                {
                  type: 'text',
                  text: formatSearchResults(results, pattern, true),
                },
              ],
            }
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
          repositories,
        )

        if (config.cacheEnabled) {
          searchCache.set(cacheKey, results)
        }

        return {
          content: [
            {
              type: 'text',
              text: formatSearchResults(results, pattern, false),
            },
          ],
        }
      }
      catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${(error as Error).message}` }],
          isError: true,
        }
      }
    },
  )
}
