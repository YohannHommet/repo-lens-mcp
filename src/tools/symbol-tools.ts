import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { RepositoryManager } from '../core/repository-manager.js'
import type { SymbolSearchEngine } from '../search/symbol-search.js'
import type { SymbolResult } from '../types/symbols.js'
import { z } from 'zod'
import { logger } from '../utils/logger.js'
import { formatToolResponse, handleToolError, READONLY_ANNOTATIONS, resolveRepositories } from './tool-utils.js'

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

const languageEnum = z.enum(['typescript', 'javascript', 'ts', 'js', 'php'])


const symbolOutputSchema = {
  count: z.number().int().describe('Number of results returned'),
  results: z.array(z.object({
    repository: z.string(),
    repositoryAlias: z.string().optional(),
    filePath: z.string(),
    relativePath: z.string(),
    name: z.string(),
    kind: z.string(),
    startLine: z.number().int(),
    endLine: z.number().int(),
    signature: z.string().optional(),
    exported: z.boolean(),
  })).describe('Array of symbol results'),
}

function symbolInputSchema(nameDescription: string) {
  return z.object({
    name: z.string().min(1).optional().describe(nameDescription),
    paths: z.string().optional().describe('Ad-hoc directory paths to search (comma-separated). No registration needed.'),
    repoFilter: z.string().optional().describe('Filter registered repositories by alias (comma-separated)'),
    language: languageEnum.optional().describe('Filter by language (typescript, javascript, php, ts, js)'),
    exportedOnly: z.boolean().optional().describe('Only return exported symbols (default: false)'),
    maxResults: z.number().int().min(1).max(500).optional().describe('Maximum results (default: 100, max: 500)'),
    response_format: z.enum(['json', 'markdown']).optional().describe('Output format: "markdown" (default) or "json"'),
  }).strict()
}

export function registerSymbolTools(
  server: McpServer,
  repoManager: RepositoryManager,
  symbolSearch: SymbolSearchEngine,
) {
  server.registerTool(
    'repolens_find_functions',
    {
      title: 'Find Functions',
      description: `Find function and method definitions across repositories using AST analysis.

Searches for function declarations, arrow functions, and class methods in JS/TS and PHP. Uses ast-grep for accurate structural matching.

Args:
  - name (string, optional): Function name pattern. Supports wildcards: "handle*", "*Controller", "*user*"
  - paths (string, optional): Ad-hoc directory paths to search (comma-separated). No registration needed.
  - repoFilter (string, optional): Filter registered repositories by alias (comma-separated)
  - language (string, optional): Filter by language: "typescript", "javascript", "php"
  - exportedOnly (boolean, optional): Only return exported functions (default: false)
  - maxResults (number, optional): Maximum results to return (default: 100)
  - response_format (string, optional): Output format - "markdown" (default) or "json"

Examples:
  - Search a directory directly: paths="/home/user/projects/api"
  - Find all handlers: name="handle*"
  - Find exported functions in backend: repoFilter="backend", exportedOnly=true`,
      inputSchema: symbolInputSchema('Function name pattern (supports wildcards like \'handle*\')'),
      outputSchema: symbolOutputSchema,
      annotations: READONLY_ANNOTATIONS,
    },
    async ({ name, paths, repoFilter, language, exportedOnly, maxResults, response_format }, _extra) => {
      logger.debug('Tool find_functions called', { name, paths, repoFilter, language, response_format })
      try {
        const resolved = resolveRepositories(repoManager, repoFilter, paths)
        if ('error' in resolved) return resolved.error

        const results = await symbolSearch.search(
          { kind: 'function', name, language, exportedOnly: exportedOnly ?? false, maxResults: maxResults ?? 100 },
          resolved.repositories,
        )

        return formatToolResponse(response_format, results, data => formatSymbolResults(data as SymbolResult[], 'function', name))
      }
      catch (error) {
        return handleToolError(error, 'find_functions')
      }
    },
  )

  server.registerTool(
    'repolens_find_classes',
    {
      title: 'Find Classes',
      description: `Find class definitions across repositories using AST analysis.

Searches for class declarations. Also finds PHP traits. Uses ast-grep for accurate structural matching.

Args:
  - name (string, optional): Class name pattern. Supports wildcards: "*Service", "*Controller", "Base*"
  - paths (string, optional): Ad-hoc directory paths to search (comma-separated). No registration needed.
  - repoFilter (string, optional): Filter registered repositories by alias (comma-separated)
  - language (string, optional): Filter by language: "typescript", "javascript", "php"
  - exportedOnly (boolean, optional): Only return exported classes (default: false)
  - maxResults (number, optional): Maximum results to return (default: 100)
  - response_format (string, optional): Output format - "markdown" (default) or "json"

Examples:
  - Search a directory directly: paths="/home/user/projects/api"
  - Find all services: name="*Service"
  - Find controllers in backend: repoFilter="backend", name="*Controller"`,
      inputSchema: symbolInputSchema('Class name pattern'),
      outputSchema: symbolOutputSchema,
      annotations: READONLY_ANNOTATIONS,
    },
    async ({ name, paths, repoFilter, language, exportedOnly, maxResults, response_format }, _extra) => {
      logger.debug('Tool find_classes called', { name, paths, repoFilter, language, response_format })
      try {
        const resolved = resolveRepositories(repoManager, repoFilter, paths)
        if ('error' in resolved) return resolved.error

        const results = await symbolSearch.search(
          { kind: 'class', name, language, exportedOnly: exportedOnly ?? false, maxResults: maxResults ?? 100 },
          resolved.repositories,
        )

        return formatToolResponse(response_format, results, data => formatSymbolResults(data as SymbolResult[], 'class', name))
      }
      catch (error) {
        return handleToolError(error, 'find_classes')
      }
    },
  )

  server.registerTool(
    'repolens_find_types',
    {
      title: 'Find Types',
      description: `Find type aliases and interface definitions across repositories using AST analysis.

Searches for both "type" and "interface" declarations. For PHP, finds interface declarations (PHP has no type aliases). Uses ast-grep for accurate structural matching.

Args:
  - name (string, optional): Type/interface name pattern. Supports wildcards: "*Props", "*Config", "I*"
  - paths (string, optional): Ad-hoc directory paths to search (comma-separated). No registration needed.
  - repoFilter (string, optional): Filter registered repositories by alias (comma-separated)
  - language (string, optional): Filter by language: "typescript", "javascript", "php"
  - exportedOnly (boolean, optional): Only return exported types (default: false)
  - maxResults (number, optional): Maximum results to return (default: 100)
  - response_format (string, optional): Output format - "markdown" (default) or "json"

Examples:
  - Search a directory directly: paths="/home/user/projects/api"
  - Find all props types: name="*Props"
  - Find interfaces with prefix: name="I*", exportedOnly=true`,
      inputSchema: symbolInputSchema('Type name pattern'),
      outputSchema: symbolOutputSchema,
      annotations: READONLY_ANNOTATIONS,
    },
    async ({ name, paths, repoFilter, language, exportedOnly, maxResults, response_format }, _extra) => {
      logger.debug('Tool find_types called', { name, paths, repoFilter, language, response_format })
      try {
        const resolved = resolveRepositories(repoManager, repoFilter, paths)
        if ('error' in resolved) return resolved.error

        const results = await symbolSearch.search(
          { kinds: ['type', 'interface'], name, language, exportedOnly: exportedOnly ?? false, maxResults: maxResults ?? 100 },
          resolved.repositories,
        )

        return formatToolResponse(response_format, results, data => formatSymbolResults(data as SymbolResult[], 'type', name))
      }
      catch (error) {
        return handleToolError(error, 'find_types')
      }
    },
  )
}
