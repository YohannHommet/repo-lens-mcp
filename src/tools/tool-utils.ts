import type { RepositoryManager } from '../core/repository-manager.js'
import type { Repository } from '../types/repository.js'
import { CHARACTER_LIMIT } from '../constants.js'
import { logger } from '../utils/logger.js'
import { splitCommaSeparated } from '../utils/string-utils.js'

interface ToolResponse {
  content: Array<{ type: string, text: string }>
  isError?: boolean
}

/**
 * Resolve repositories from a comma-separated filter string.
 * Returns either the repositories or an error response.
 */
export function resolveRepositories(
  repoManager: RepositoryManager,
  repoFilter: string | undefined,
): { repositories: Repository[] } | { error: ToolResponse } {
  const repos = splitCommaSeparated(repoFilter)
  const repositories = repoManager.resolveIdentifiers(repos)

  if (repositories.length === 0) {
    return {
      error: {
        content: [{ type: 'text', text: 'No repositories found. Use repolens_register_repository to add repositories, or check repoFilter value matches registered repos.' }],
        isError: true,
      },
    }
  }

  return { repositories }
}

/**
 * Format a tool response with JSON/markdown switching and character limit truncation.
 */
export function formatToolResponse(
  responseFormat: 'json' | 'markdown' | undefined,
  results: unknown[],
  formatMarkdown: () => string,
): ToolResponse {
  let text: string

  if (responseFormat === 'json') {
    text = JSON.stringify(results, null, 2)
  }
  else {
    text = formatMarkdown()
  }

  if (text.length > CHARACTER_LIMIT) {
    const truncatedResults = results.slice(0, Math.max(1, Math.floor(results.length / 2)))
    const retryText = responseFormat === 'json'
      ? JSON.stringify(truncatedResults, null, 2)
      : formatMarkdown()

    text = `${retryText}\n\n---\n_Response truncated from ${results.length} to ${truncatedResults.length} results. Use \`maxResults\` or add filters to narrow your search._`
  }

  return { content: [{ type: 'text', text }] }
}

/**
 * Wrap a tool handler with standard error handling.
 */
export function handleToolError(error: unknown, toolName: string): ToolResponse {
  const message = error instanceof Error ? error.message : String(error)
  logger.error(`Tool ${toolName} error`, { error })
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true,
  }
}
