import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { RepositoryManager } from '../core/repository-manager.js'
import type { Repository } from '../types/repository.js'
import { CHARACTER_LIMIT } from '../constants.js'
import { logger } from '../utils/logger.js'
import { splitCommaSeparated } from '../utils/string-utils.js'

export type ToolResponse = CallToolResult

export const READONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const

/**
 * Resolve repositories from registered repos (repoFilter) and/or ad-hoc paths.
 * Merges both sources with deduplication by path.
 */
export function resolveRepositories(
  repoManager: RepositoryManager,
  repoFilter: string | undefined,
  paths: string | undefined,
): { repositories: Repository[] } | { error: ToolResponse } {
  const filterIds = splitCommaSeparated(repoFilter)
  const adHocPaths = splitCommaSeparated(paths)

  const registeredRepos = repoManager.resolveIdentifiers(filterIds)
  const adHocRepos = adHocPaths ? repoManager.createAdHocRepositories(adHocPaths) : []

  // Merge and deduplicate by path
  const seen = new Set<string>()
  const repositories: Repository[] = []
  for (const repo of [...registeredRepos, ...adHocRepos]) {
    if (!seen.has(repo.path)) {
      seen.add(repo.path)
      repositories.push(repo)
    }
  }

  if (repositories.length === 0) {
    return {
      error: {
        content: [{ type: 'text' as const, text: 'No repositories found. Configure repos in repolens.yaml, or pass paths directly to search tools.' }],
        isError: true,
      },
    }
  }

  return { repositories }
}

/**
 * Format a tool response with JSON/markdown switching, structured content, and character limit truncation.
 */
export function formatToolResponse(
  responseFormat: 'json' | 'markdown' | undefined,
  results: unknown[],
  formatMarkdown: (data: unknown[]) => string,
): ToolResponse {
  let text: string
  let outputResults = results

  if (responseFormat === 'json') {
    text = JSON.stringify(results, null, 2)
  }
  else {
    text = formatMarkdown(results)
  }

  if (text.length > CHARACTER_LIMIT) {
    outputResults = results.slice(0, Math.max(1, Math.floor(results.length / 2)))
    const retryText = responseFormat === 'json'
      ? JSON.stringify(outputResults, null, 2)
      : formatMarkdown(outputResults)

    text = `${retryText}\n\n---\n_Response truncated from ${results.length} to ${outputResults.length} results. Use \`maxResults\` or add filters to narrow your search._`
  }

  return {
    content: [{ type: 'text' as const, text }],
    structuredContent: {
      count: outputResults.length,
      results: outputResults,
    },
  }
}

/**
 * Wrap a tool handler with standard error handling.
 */
export function handleToolError(error: unknown, toolName: string): ToolResponse {
  const message = error instanceof Error ? error.message : String(error)
  logger.error(`Tool ${toolName} error`, { error })
  return {
    content: [{ type: 'text' as const, text: `Error: ${message}` }],
    isError: true,
  }
}
