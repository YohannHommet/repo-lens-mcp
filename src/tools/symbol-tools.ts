import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ServerConfig } from '../config/types.js'
import type { RepositoryManager } from '../core/repository-manager.js'
import type { SymbolSearchEngine } from '../search/symbol-search.js'
import type { SearchCache } from '../utils/cache.js'
import { z } from 'zod'
import { logger } from '../utils/logger.js'
import { getLanguageForFile } from '../utils/path-utils.js'
import { splitCommaSeparated } from '../utils/string-utils.js'

/**
 * Helper to format symbol results as Markdown
 */
function formatSymbolResults(results: any[], kind: string, pattern: string | undefined, isCached: boolean): string {
  if (results.length === 0) {
    return `No ${kind}s found matching "${pattern || '*'}"`
  }

  let output = `## Found ${results.length} ${kind}s${pattern ? ` matching "${pattern}"` : ''}${isCached ? ' (cached)' : ''}\n\n`

  // Group by file
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
      const lineInfo = `L${m.startLine}${m.endLine !== m.startLine ? `-${m.endLine}` : ''}`
      output += `${lineInfo.padEnd(8)} | ${m.signature || m.name}${m.exported ? ' (exported)' : ''}\n`
    }
    output += `\`\`\`\n\n`
  }

  return output
}

export function registerSymbolTools(
  server: McpServer,
  repoManager: RepositoryManager,
  symbolSearch: SymbolSearchEngine,
  searchCache: SearchCache<any>,
  config: ServerConfig,
) {
  server.tool(
    'find_functions',
    'Find function/method definitions across repositories using AST analysis',
    {
      name: z.string().optional().describe('Function name pattern (supports wildcards like \'handle*\')'),
      repoFilter: z.string().optional().describe('Repository aliases or paths to search (comma-separated)'),
      language: z.string().optional().describe('Filter by language (typescript, javascript)'),
      exportedOnly: z.boolean().optional().describe('Only return exported functions (default: false)'),
      maxResults: z.number().optional().describe('Maximum results (default: 100)'),
    },
    async ({ name, repoFilter, language, exportedOnly, maxResults }) => {
      logger.debug('Tool find_functions called', { name, repoFilter, language })
      try {
        const repos = splitCommaSeparated(repoFilter)
        const repositories = repoManager.resolveIdentifiers(repos)

        if (repositories.length === 0) {
          return {
            content: [{ type: 'text', text: 'No repositories found. Register repositories first.' }],
            isError: true,
          }
        }

        // Check cache
        const cacheKey = searchCache.generateKey('symbol:function', {
          name,
          repos: repositories.map(r => r.id).sort(),
          language,
          exportedOnly,
          maxResults,
        })

        if (config.cacheEnabled) {
          const cached = searchCache.get(cacheKey)
          if (cached) {
            return {
              content: [
                {
                  type: 'text',
                  text: formatSymbolResults(cached, 'function', name, true),
                },
              ],
            }
          }
        }

        const results = await symbolSearch.search(
          {
            kind: 'function',
            name,
            language,
            exportedOnly: exportedOnly ?? false,
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
              text: formatSymbolResults(results, 'function', name, false),
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

  server.tool(
    'find_classes',
    'Find class definitions across repositories using AST analysis',
    {
      name: z.string().optional().describe('Class name pattern'),
      repoFilter: z.string().optional().describe('Repository aliases or paths to search (comma-separated)'),
      language: z.string().optional().describe('Filter by language'),
      exportedOnly: z.boolean().optional().describe('Only return exported classes'),
      maxResults: z.number().optional().describe('Maximum results'),
    },
    async ({ name, repoFilter, language, exportedOnly, maxResults }) => {
      logger.debug('Tool find_classes called', { name, repoFilter, language })
      try {
        const repos = splitCommaSeparated(repoFilter)
        const repositories = repoManager.resolveIdentifiers(repos)

        if (repositories.length === 0) {
          return {
            content: [{ type: 'text', text: 'No repositories found.' }],
            isError: true,
          }
        }

        // Check cache
        const cacheKey = searchCache.generateKey('symbol:class', {
          name,
          repos: repositories.map(r => r.id).sort(),
          language,
          exportedOnly,
          maxResults,
        })

        if (config.cacheEnabled) {
          const cached = searchCache.get(cacheKey)
          if (cached) {
            return {
              content: [
                {
                  type: 'text',
                  text: formatSymbolResults(cached, 'class', name, true),
                },
              ],
            }
          }
        }

        const results = await symbolSearch.search(
          {
            kind: 'class',
            name,
            language,
            exportedOnly: exportedOnly ?? false,
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
              text: formatSymbolResults(results, 'class', name, false),
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

  server.tool(
    'find_types',
    'Find type/interface definitions across repositories using AST analysis',
    {
      name: z.string().optional().describe('Type name pattern'),
      repoFilter: z.string().optional().describe('Repository aliases or paths to search (comma-separated)'),
      language: z.string().optional().describe('Filter by language'),
      exportedOnly: z.boolean().optional().describe('Only return exported types'),
      maxResults: z.number().optional().describe('Maximum results'),
    },
    async ({ name, repoFilter, language, exportedOnly, maxResults }) => {
      logger.debug('Tool find_types called', { name, repoFilter, language })
      try {
        const repos = splitCommaSeparated(repoFilter)
        const repositories = repoManager.resolveIdentifiers(repos)

        if (repositories.length === 0) {
          return {
            content: [{ type: 'text', text: 'No repositories found.' }],
            isError: true,
          }
        }

        // Check cache
        const cacheKey = searchCache.generateKey('symbol:types', {
          name,
          repos: repositories.map(r => r.id).sort(),
          language,
          exportedOnly,
          maxResults,
        })

        if (config.cacheEnabled) {
          const cached = searchCache.get(cacheKey)
          if (cached) {
            return {
              content: [
                {
                  type: 'text',
                  text: formatSymbolResults(cached, 'type', name, true),
                },
              ],
            }
          }
        }

        // Search both types and interfaces
        const [typeResults, interfaceResults] = await Promise.all([
          symbolSearch.search(
            { kind: 'type', name, language, exportedOnly: exportedOnly ?? false, maxResults: maxResults ?? 50 },
            repositories,
          ),
          symbolSearch.search(
            { kind: 'interface', name, language, exportedOnly: exportedOnly ?? false, maxResults: maxResults ?? 50 },
            repositories,
          ),
        ])

        const results = [...typeResults, ...interfaceResults]

        if (config.cacheEnabled) {
          searchCache.set(cacheKey, results)
        }

        return {
          content: [
            {
              type: 'text',
              text: formatSymbolResults(results, 'type', name, false),
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

  server.tool(
    'find_enums',
    'Find enum definitions across repositories using AST analysis',
    {
      name: z.string().optional().describe('Enum name pattern'),
      repoFilter: z.string().optional().describe('Repository aliases or paths to search (comma-separated)'),
      language: z.string().optional().describe('Filter by language'),
      exportedOnly: z.boolean().optional().describe('Only return exported enums'),
      maxResults: z.number().optional().describe('Maximum results'),
    },
    async ({ name, repoFilter, language, exportedOnly, maxResults }) => {
      logger.debug('Tool find_enums called', { name, repoFilter, language })
      try {
        const repos = splitCommaSeparated(repoFilter)
        const repositories = repoManager.resolveIdentifiers(repos)

        if (repositories.length === 0) {
          return {
            content: [{ type: 'text', text: 'No repositories found.' }],
            isError: true,
          }
        }

        // Check cache
        const cacheKey = searchCache.generateKey('symbol:enum', {
          name,
          repos: repositories.map(r => r.id).sort(),
          language,
          exportedOnly,
          maxResults,
        })

        if (config.cacheEnabled) {
          const cached = searchCache.get(cacheKey)
          if (cached) {
            return {
              content: [
                {
                  type: 'text',
                  text: formatSymbolResults(cached, 'enum', name, true),
                },
              ],
            }
          }
        }

        const results = await symbolSearch.search(
          {
            kind: 'enum',
            name,
            language,
            exportedOnly: exportedOnly ?? false,
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
              text: formatSymbolResults(results, 'enum', name, false),
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

  server.tool(
    'find_variables',
    'Find variable declarations across repositories using AST analysis',
    {
      name: z.string().optional().describe('Variable name pattern'),
      repoFilter: z.string().optional().describe('Repository aliases or paths to search (comma-separated)'),
      language: z.string().optional().describe('Filter by language'),
      exportedOnly: z.boolean().optional().describe('Only return exported variables'),
      maxResults: z.number().optional().describe('Maximum results'),
    },
    async ({ name, repoFilter, language, exportedOnly, maxResults }) => {
      logger.debug('Tool find_variables called', { name, repoFilter, language })
      try {
        const repos = splitCommaSeparated(repoFilter)
        const repositories = repoManager.resolveIdentifiers(repos)

        if (repositories.length === 0) {
          return {
            content: [{ type: 'text', text: 'No repositories found.' }],
            isError: true,
          }
        }

        // Check cache
        const cacheKey = searchCache.generateKey('symbol:variable', {
          name,
          repos: repositories.map(r => r.id).sort(),
          language,
          exportedOnly,
          maxResults,
        })

        if (config.cacheEnabled) {
          const cached = searchCache.get(cacheKey)
          if (cached) {
            return {
              content: [
                {
                  type: 'text',
                  text: formatSymbolResults(cached, 'variable', name, true),
                },
              ],
            }
          }
        }

        const results = await symbolSearch.search(
          {
            kind: 'variable',
            name,
            language,
            exportedOnly: exportedOnly ?? false,
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
              text: formatSymbolResults(results, 'variable', name, false),
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

  server.tool(
    'find_constants',
    'Find constant declarations across repositories using AST analysis',
    {
      name: z.string().optional().describe('Constant name pattern'),
      repoFilter: z.string().optional().describe('Repository aliases or paths to search (comma-separated)'),
      language: z.string().optional().describe('Filter by language'),
      exportedOnly: z.boolean().optional().describe('Only return exported constants'),
      maxResults: z.number().optional().describe('Maximum results'),
    },
    async ({ name, repoFilter, language, exportedOnly, maxResults }) => {
      logger.debug('Tool find_constants called', { name, repoFilter, language })
      try {
        const repos = splitCommaSeparated(repoFilter)
        const repositories = repoManager.resolveIdentifiers(repos)

        if (repositories.length === 0) {
          return {
            content: [{ type: 'text', text: 'No repositories found.' }],
            isError: true,
          }
        }

        // Check cache
        const cacheKey = searchCache.generateKey('symbol:constant', {
          name,
          repos: repositories.map(r => r.id).sort(),
          language,
          exportedOnly,
          maxResults,
        })

        if (config.cacheEnabled) {
          const cached = searchCache.get(cacheKey)
          if (cached) {
            return {
              content: [
                {
                  type: 'text',
                  text: formatSymbolResults(cached, 'constant', name, true),
                },
              ],
            }
          }
        }

        const results = await symbolSearch.search(
          {
            kind: 'constant',
            name,
            language,
            exportedOnly: exportedOnly ?? false,
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
              text: formatSymbolResults(results, 'constant', name, false),
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
