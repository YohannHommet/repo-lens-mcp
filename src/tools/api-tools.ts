import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { RepositoryManager } from '../core/repository-manager.js'
import type { APIRouteSearchEngine } from '../search/api-route-search.js'
import type { APIRoute } from '../types/symbols.js'
import { z } from 'zod'
import { logger } from '../utils/logger.js'
import { splitCommaSeparated } from '../utils/string-utils.js'

/**
 * Format API route results in a token-efficient format
 */
function formatApiRoutes(results: APIRoute[]): string {
  if (results.length === 0) {
    return 'No API routes found.'
  }

  const lines: string[] = [`Found ${results.length} routes:`]

  // Group by repository
  const byRepo = results.reduce<Record<string, APIRoute[]>>((acc, r) => {
    const key = r.repositoryAlias || r.repository
    if (!acc[key])
      acc[key] = []
    acc[key].push(r)
    return acc
  }, {})

  for (const [repo, routes] of Object.entries(byRepo)) {
    lines.push(`\n[${repo}]`)
    for (const r of routes) {
      const fw = r.framework ? `[${r.framework}]` : ''
      lines.push(`  ${r.method} ${r.path} ${fw} ${r.relativePath}:${r.lineNumber}`)
    }
  }

  return lines.join('\n')
}

export function registerApiTools(
  server: McpServer,
  repoManager: RepositoryManager,
  apiRouteSearch: APIRouteSearchEngine,
) {
  server.tool(
    'find_api_routes',
    'Find API route definitions in backend code (Express, Fastify, NestJS, Laravel). Perfect for frontend devs needing to know backend endpoints.',
    {
      method: z.string().optional().describe('HTTP method (GET, POST, PUT, DELETE, PATCH)'),
      pathPattern: z.string().optional().describe('Filter by path pattern (e.g., "/users", "/api")'),
      repoFilter: z.string().optional().describe('Repository aliases or paths to search (comma-separated)'),
      framework: z.string().optional().describe('Filter by framework (express, fastify, nestjs, laravel)'),
      maxResults: z.number().optional().describe('Maximum results'),
    },
    async ({ method, pathPattern, repoFilter, framework, maxResults }) => {
      logger.debug('Tool find_api_routes called', { method, pathPattern, repoFilter, framework })
      try {
        const repos = splitCommaSeparated(repoFilter)
        const repositories = repoManager.resolveIdentifiers(repos)

        if (repositories.length === 0) {
          return {
            content: [{ type: 'text', text: 'No repositories found.' }],
            isError: true,
          }
        }

        const results = await apiRouteSearch.search(
          {
            method,
            pathPattern,
            framework,
            maxResults: maxResults ?? 100,
          },
          repositories,
        )

        return {
          content: [
            {
              type: 'text',
              text: formatApiRoutes(results),
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
