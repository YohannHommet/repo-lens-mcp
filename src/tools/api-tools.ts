import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { RepositoryManager } from '../core/repository-manager.js'
import type { APIRouteSearchEngine } from '../search/api-route-search.js'
import type { APIRoute } from '../types/symbols.js'
import { z } from 'zod'
import { logger } from '../utils/logger.js'
import { formatToolResponse, handleToolError, resolveRepositories } from './tool-utils.js'

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

Searches for HTTP route definitions in Express, Fastify, NestJS, and Laravel codebases.

Supported Frameworks: Express, Fastify, NestJS, Laravel (PHP)

Args:
  - method (string, optional): Filter by HTTP method: "GET", "POST", "PUT", "DELETE", "PATCH"
  - pathPattern (string, optional): Filter routes containing this path segment (e.g., "/users", "/api/v1")
  - paths (string, optional): Ad-hoc directory paths to search (comma-separated). No registration needed.
  - repoFilter (string, optional): Filter registered repositories by alias (comma-separated)
  - framework (string, optional): Filter by framework: "express", "fastify", "nestjs", "laravel"
  - maxResults (number, optional): Maximum results to return (default: 100)
  - response_format (string, optional): Output format - "markdown" (default) or "json"

Examples:
  - Search a directory directly: paths="/home/user/projects/api"
  - Find all user endpoints: pathPattern="/users"
  - Find POST routes in backend: repoFilter="backend-api", method="POST"
  - Find NestJS controllers: framework="nestjs"`,
      inputSchema: z.object({
        method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL']).optional().describe('HTTP method (GET, POST, PUT, DELETE, PATCH)'),
        pathPattern: z.string().optional().describe('Filter by path pattern (e.g., "/users", "/api")'),
        paths: z.string().optional().describe('Ad-hoc directory paths to search (comma-separated). No registration needed.'),
        repoFilter: z.string().optional().describe('Filter registered repositories by alias (comma-separated)'),
        framework: z.enum(['express', 'fastify', 'nestjs', 'laravel']).optional().describe('Filter by framework (express, fastify, nestjs, laravel)'),
        maxResults: z.number().int().min(1).max(500).optional().describe('Maximum results (default: 100, max: 500)'),
        response_format: z.enum(['json', 'markdown']).optional().describe('Output format: "markdown" (default) or "json"'),
      }).strict(),
      outputSchema: {
        count: z.number().int().describe('Number of results returned'),
        results: z.array(z.object({
          repository: z.string(),
          repositoryAlias: z.string().optional(),
          method: z.string(),
          path: z.string(),
          handler: z.string(),
          filePath: z.string(),
          relativePath: z.string(),
          lineNumber: z.number().int(),
          framework: z.string().optional(),
        })).describe('Array of API route results'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ method, pathPattern, paths, repoFilter, framework, maxResults, response_format }) => {
      logger.debug('Tool find_api_routes called', { method, pathPattern, paths, repoFilter, framework, response_format })
      try {
        const resolved = resolveRepositories(repoManager, repoFilter, paths)
        if ('error' in resolved) return resolved.error

        const results = await apiRouteSearch.search(
          { method, pathPattern, framework, maxResults: maxResults ?? 100 },
          resolved.repositories,
        )

        return formatToolResponse(response_format, results, () => formatApiRoutes(results))
      }
      catch (error) {
        return handleToolError(error, 'find_api_routes')
      }
    },
  )
}
