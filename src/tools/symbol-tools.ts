import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { RepositoryManager } from '../core/repository-manager.js'
import type { SymbolSearchEngine } from '../search/symbol-search.js'
import type { SymbolResult } from '../types/symbols.js'
import { z } from 'zod'
import { logger } from '../utils/logger.js'
import { formatToolResponse, handleToolError, resolveRepositories } from './tool-utils.js'

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

const languageEnum = z.enum(['typescript', 'javascript', 'ts', 'js'])

const symbolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const

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
    repoFilter: z.string().optional().describe('Repository aliases or paths to search (comma-separated)'),
    language: languageEnum.optional().describe('Filter by language (typescript, javascript, ts, js)'),
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

Searches registered repositories for function declarations, arrow functions, and class methods. Uses ast-grep for accurate structural matching rather than text search.

Args:
  - name (string, optional): Function name pattern. Supports wildcards: "handle*", "*Controller", "*user*"
  - repoFilter (string, optional): Comma-separated repository aliases or paths to limit search scope
  - language (string, optional): Filter by language: "typescript", "javascript"
  - exportedOnly (boolean, optional): Only return exported functions (default: false)
  - maxResults (number, optional): Maximum results to return (default: 100)
  - response_format (string, optional): Output format - "markdown" (default) or "json"

Returns:
  Markdown: Text grouped by repository and file with line numbers and signatures
  JSON: Array of SymbolResult objects with full metadata

Examples:
  - Find all handlers: name="handle*"
  - Find exported functions in backend: repoFilter="backend", exportedOnly=true
  - Search specific repos: repoFilter="frontend,shared-utils"

Error Handling:
  - "No repositories found" if no repos registered or repoFilter matches nothing
  - "No functions found" if search returns empty`,
      inputSchema: symbolInputSchema('Function name pattern (supports wildcards like \'handle*\')'),
      outputSchema: symbolOutputSchema,
      annotations: symbolAnnotations,
    },
    async ({ name, repoFilter, language, exportedOnly, maxResults, response_format }) => {
      logger.debug('Tool find_functions called', { name, repoFilter, language, response_format })
      try {
        const resolved = resolveRepositories(repoManager, repoFilter)
        if ('error' in resolved) return resolved.error

        const results = await symbolSearch.search(
          { kind: 'function', name, language, exportedOnly: exportedOnly ?? false, maxResults: maxResults ?? 100 },
          resolved.repositories,
        )

        return formatToolResponse(response_format, results, () => formatSymbolResults(results, 'function', name))
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

Searches registered repositories for class declarations. Uses ast-grep for accurate structural matching.

Args:
  - name (string, optional): Class name pattern. Supports wildcards: "*Service", "*Controller", "Base*"
  - repoFilter (string, optional): Comma-separated repository aliases or paths to limit search scope
  - language (string, optional): Filter by language: "typescript", "javascript"
  - exportedOnly (boolean, optional): Only return exported classes (default: false)
  - maxResults (number, optional): Maximum results to return (default: 100)
  - response_format (string, optional): Output format - "markdown" (default) or "json"

Returns:
  Markdown: Text grouped by repository and file with line numbers and signatures
  JSON: Array of SymbolResult objects with full metadata

Examples:
  - Find all services: name="*Service"
  - Find controllers in backend: repoFilter="backend", name="*Controller"
  - Find exported base classes: name="Base*", exportedOnly=true

Error Handling:
  - "No repositories found" if no repos registered or repoFilter matches nothing
  - "No classes found" if search returns empty`,
      inputSchema: symbolInputSchema('Class name pattern'),
      outputSchema: symbolOutputSchema,
      annotations: symbolAnnotations,
    },
    async ({ name, repoFilter, language, exportedOnly, maxResults, response_format }) => {
      logger.debug('Tool find_classes called', { name, repoFilter, language, response_format })
      try {
        const resolved = resolveRepositories(repoManager, repoFilter)
        if ('error' in resolved) return resolved.error

        const results = await symbolSearch.search(
          { kind: 'class', name, language, exportedOnly: exportedOnly ?? false, maxResults: maxResults ?? 100 },
          resolved.repositories,
        )

        return formatToolResponse(response_format, results, () => formatSymbolResults(results, 'class', name))
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
      description: `Find TypeScript type aliases and interface definitions across repositories using AST analysis.

Searches registered repositories for both "type" and "interface" declarations. Uses ast-grep for accurate structural matching.

Args:
  - name (string, optional): Type/interface name pattern. Supports wildcards: "*Props", "*Config", "I*"
  - repoFilter (string, optional): Comma-separated repository aliases or paths to limit search scope
  - language (string, optional): Filter by language: "typescript" (types are TypeScript-specific)
  - exportedOnly (boolean, optional): Only return exported types (default: false)
  - maxResults (number, optional): Maximum results to return (default: 100, split between types and interfaces)
  - response_format (string, optional): Output format - "markdown" (default) or "json"

Returns:
  Markdown: Text grouped by repository and file with line numbers and signatures
  JSON: Array of SymbolResult objects with full metadata

Examples:
  - Find all props types: name="*Props"
  - Find config types: name="*Config"
  - Find interfaces with prefix: name="I*", exportedOnly=true

Error Handling:
  - "No repositories found" if no repos registered or repoFilter matches nothing
  - "No types found" if search returns empty`,
      inputSchema: symbolInputSchema('Type name pattern'),
      outputSchema: symbolOutputSchema,
      annotations: symbolAnnotations,
    },
    async ({ name, repoFilter, language, exportedOnly, maxResults, response_format }) => {
      logger.debug('Tool find_types called', { name, repoFilter, language, response_format })
      try {
        const resolved = resolveRepositories(repoManager, repoFilter)
        if ('error' in resolved) return resolved.error

        const results = await symbolSearch.search(
          { kinds: ['type', 'interface'], name, language, exportedOnly: exportedOnly ?? false, maxResults: maxResults ?? 100 },
          resolved.repositories,
        )

        return formatToolResponse(response_format, results, () => formatSymbolResults(results, 'type', name))
      }
      catch (error) {
        return handleToolError(error, 'find_types')
      }
    },
  )
}
