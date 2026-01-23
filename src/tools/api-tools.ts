import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ServerConfig } from '../config/types.js'
import type { RepositoryManager } from '../core/repository-manager.js'
import type { APIRouteSearchEngine } from '../search/api-route-search.js'
import type { SearchCache } from '../utils/cache.js'
import { z } from 'zod'

export function registerApiTools(
  server: McpServer,
  repoManager: RepositoryManager,
  apiRouteSearch: APIRouteSearchEngine,
  searchCache: SearchCache<any>,
  config: ServerConfig,
) {
  server.tool(
    'find_api_routes',
    'Find API route definitions in backend code (Express, Fastify, NestJS). Perfect for frontend devs needing to know backend endpoints.',
    {
      method: z.string().optional().describe('HTTP method (GET, POST, PUT, DELETE, PATCH)'),
      pathPattern: z.string().optional().describe('Filter by path pattern (e.g., "/users", "/api")'),
      repos: z.array(z.string()).optional().describe('Repository identifiers to search'),
      framework: z.string().optional().describe('Filter by framework (express, fastify, nestjs)'),
      maxResults: z.number().optional().describe('Maximum results'),
    },
    async ({ method, pathPattern, repos, framework, maxResults }) => {
      try {
        const repositories = repoManager.resolveIdentifiers(repos)

        if (repositories.length === 0) {
          return {
            content: [{ type: 'text', text: 'No repositories found.' }],
            isError: true,
          }
        }

        // Check cache
        const cacheKey = searchCache.generateKey('api_routes', {
          method,
          pathPattern,
          repos: repositories.map(r => r.id).sort(),
          framework,
          maxResults,
        })

        if (config.cacheEnabled) {
          const cached = searchCache.get(cacheKey)
          if (cached) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      totalFound: (cached as any[]).length,
                      routes: (cached as any[]).map(r => ({
                        method: r.method,
                        path: r.path,
                        handler: r.handler,
                        framework: r.framework,
                        repository: r.repositoryAlias || r.repository,
                        file: r.relativePath,
                        line: r.lineNumber,
                        parameters: r.parameters,
                        middleware: r.middleware,
                      })),
                      cached: true,
                    },
                    null,
                    2,
                  ),
                },
              ],
            }
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

        if (config.cacheEnabled) {
          searchCache.set(cacheKey, results)
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  totalFound: results.length,
                  routes: results.map(r => ({
                    method: r.method,
                    path: r.path,
                    handler: r.handler,
                    framework: r.framework,
                    repository: r.repositoryAlias || r.repository,
                    file: r.relativePath,
                    line: r.lineNumber,
                    parameters: r.parameters,
                    middleware: r.middleware,
                  })),
                },
                null,
                2,
              ),
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
