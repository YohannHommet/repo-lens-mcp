import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { RepositoryManager } from '../core/repository-manager.js'
import type { SymbolSearchEngine } from '../search/symbol-search.js'
import type { SymbolResult } from '../types/symbols.js'
import { z } from 'zod'
import { logger } from '../utils/logger.js'
import { splitCommaSeparated } from '../utils/string-utils.js'

/**
 * Format symbol results in a token-efficient format
 */
function formatSymbolResults(results: SymbolResult[], kind: string, pattern: string | undefined): string {
  if (results.length === 0) {
    return `No ${kind}s found${pattern ? ` matching "${pattern}"` : ''}`
  }

  const lines: string[] = [`Found ${results.length} ${kind}s:`]

  // Group by repo then by file
  const byRepo = results.reduce<Record<string, Record<string, SymbolResult[]>>>((acc, r) => {
    const repo = r.repositoryAlias || r.repository
    if (!acc[repo])
      acc[repo] = {}
    if (!acc[repo][r.relativePath])
      acc[repo][r.relativePath] = []
    acc[repo][r.relativePath].push(r)
    return acc
  }, {})

  for (const [repo, files] of Object.entries(byRepo)) {
    lines.push(`\n[${repo}]`)
    for (const [filePath, symbols] of Object.entries(files)) {
      lines.push(`  ${filePath}`)
      for (const s of symbols) {
        const line = s.endLine !== s.startLine ? `${s.startLine}-${s.endLine}` : `${s.startLine}`
        const exp = s.exported ? ' [E]' : ''
        lines.push(`    L${line} ${s.signature || s.name}${exp}`)
      }
    }
  }

  return lines.join('\n')
}

export function registerSymbolTools(
  server: McpServer,
  repoManager: RepositoryManager,
  symbolSearch: SymbolSearchEngine,
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

        return {
          content: [
            {
              type: 'text',
              text: formatSymbolResults(results, 'function', name),
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

        return {
          content: [
            {
              type: 'text',
              text: formatSymbolResults(results, 'class', name),
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

        return {
          content: [
            {
              type: 'text',
              text: formatSymbolResults(results, 'type', name),
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
