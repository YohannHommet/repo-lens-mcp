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
  server.registerTool(
    'repolens_find_api_routes',
    {
      title: 'Find API Routes',
      description: `Find API route/endpoint definitions in backend code across repositories.

Searches for HTTP route definitions in Express, Fastify, NestJS, and Laravel codebases. Perfect for frontend developers needing to discover backend endpoints, or for understanding API surface area across microservices.

Supported Frameworks:
  - Express: app.get(), router.post(), etc.
  - Fastify: fastify.get(), fastify.route()
  - NestJS: @Get(), @Post(), @Controller() decorators
  - Laravel: Route::get(), Route::post() facades (PHP)

Args:
  - method (string, optional): Filter by HTTP method: "GET", "POST", "PUT", "DELETE", "PATCH"
  - pathPattern (string, optional): Filter routes containing this path segment (e.g., "/users", "/api/v1")
  - repoFilter (string, optional): Comma-separated repository aliases or paths to limit search scope
  - framework (string, optional): Filter by framework: "express", "fastify", "nestjs", "laravel"
  - maxResults (number, optional): Maximum results to return (default: 100)
  - response_format (string, optional): Output format - "markdown" (default) or "json"

Returns:
  Markdown: Text grouped by repository with method, path, framework, and location
  JSON: Array of APIRoute objects with full metadata

Examples:
  - Find all user endpoints: pathPattern="/users"
  - Find POST routes in backend: repoFilter="backend-api", method="POST"
  - Find NestJS controllers: framework="nestjs"
  - Find all routes across microservices: {} (empty params)

Error Handling:
  - "No repositories found" if no repos registered or repoFilter matches nothing
  - "No API routes found" if search returns empty`,
      inputSchema: z.object({
        method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL']).optional().describe('HTTP method (GET, POST, PUT, DELETE, PATCH)'),
        pathPattern: z.string().optional().describe('Filter by path pattern (e.g., "/users", "/api")'),
        repoFilter: z.string().optional().describe('Repository aliases or paths to search (comma-separated)'),
        framework: z.enum(['express', 'fastify', 'nestjs', 'laravel']).optional().describe('Filter by framework (express, fastify, nestjs, laravel)'),
        maxResults: z.number().int().min(1).max(500).optional().describe('Maximum results (default: 100, max: 500)'),
        response_format: z.enum(['json', 'markdown']).optional().describe('Output format: "markdown" (default) or "json"'),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ method, pathPattern, repoFilter, framework, maxResults, response_format }) => {
      logger.debug('Tool find_api_routes called', { method, pathPattern, repoFilter, framework, response_format })
      try {
        const repos = splitCommaSeparated(repoFilter)
        const repositories = repoManager.resolveIdentifiers(repos)

        if (repositories.length === 0) {
          return {
            content: [{ type: 'text', text: 'No repositories found. Use repolens_register_repository to add repositories, or check repoFilter value matches registered repos.' }],
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

        // JSON format - return raw results array
        if (response_format === 'json') {
          return {
            content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
          }
        }

        // Markdown format (default)
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
