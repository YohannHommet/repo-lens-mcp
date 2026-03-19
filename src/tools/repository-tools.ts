import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { RepositoryManager } from '../core/repository-manager.js'
import { z } from 'zod'
import { logger } from '../utils/logger.js'
import { handleToolError, READONLY_ANNOTATIONS } from './tool-utils.js'

export function registerRepositoryTools(
  server: McpServer,
  repoManager: RepositoryManager,
) {
  server.registerTool(
    'repolens_list_repositories',
    {
      title: 'List Repositories',
      description: `List all configured repositories available for cross-repository search.

Returns the list of repositories declared in repolens.yaml with their aliases, paths, and git branch info.

Args:
  - response_format (string, optional): Output format - "markdown" (default) or "json"`,
      inputSchema: z.object({
        response_format: z.enum(['json', 'markdown']).optional().describe('Output format: "markdown" (default) or "json"'),
      }).strict(),
      annotations: READONLY_ANNOTATIONS,
    },
    async ({ response_format }, _extra) => {
      logger.debug('Tool list_repositories called', { response_format })
      try {
        const repos = repoManager.list()
        if (repos.length === 0) {
          return {
            content: [{ type: 'text' as const, text: response_format === 'json' ? '[]' : 'No repositories configured. Add repos to repolens.yaml, or pass paths directly to search tools.' }],
          }
        }

        if (response_format === 'json') {
          return { content: [{ type: 'text' as const, text: JSON.stringify(repos, null, 2) }] }
        }

        const lines: string[] = [`${repos.length} repositories:`]
        for (const r of repos) {
          const name = r.alias || r.path.split('/').pop()
          lines.push(`  ${name}: ${r.path} (${r.gitInfo.branch})`)
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
      }
      catch (error) {
        return handleToolError(error, 'list_repositories')
      }
    },
  )
}
