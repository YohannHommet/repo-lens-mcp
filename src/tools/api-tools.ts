import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { RepositoryManager } from '../core/repository-manager.js'
import type { APIRouteSearchEngine } from '../search/api-route-search.js'
import { z } from 'zod'
import { logger } from '../utils/logger.js'
import { splitCommaSeparated } from '../utils/string-utils.js'

/**
 * Helper to format API route results as Markdown
 */
function formatApiRoutes(results: any[]): string {
  if (results.length === 0) {
    return 'No API routes found.'
  }

  let output = `## Found ${results.length} API Routes\n\n`

  // Group by repository
  const grouped = results.reduce((acc: any, r: any) => {
    const key = r.repositoryAlias || r.repository
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(r)
    return acc
  }, {})

  for (const [repo, routes] of Object.entries(grouped)) {
    output += `### Repository: ${repo}\n`
    output += '| Method | Path | Framework | File |\n'
    output += '|:---|:---|:---|:---|\n'
    for (const r of (routes as any[])) {
      output += `| **${r.method}** | \`${r.path}\` | ${r.framework} | \`${r.relativePath}\`:L${r.lineNumber} |\n`
    }
    output += '\n'
  }

  return output
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
