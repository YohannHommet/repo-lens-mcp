import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { RepositoryManager } from '../core/repository-manager.js'
import { z } from 'zod'
import { logger } from '../utils/logger.js'
import { splitCommaSeparated } from '../utils/string-utils.js'

export function registerRepositoryTools(
  server: McpServer,
  repoManager: RepositoryManager,
) {
  server.tool(
    'register_repository',
    'Register a local git repository for cross-repository search',
    {
      path: z.string().describe('Absolute path to the git repository'),
      alias: z.string().optional().describe('User-friendly name for the repository'),
      tags: z.string().optional().describe('Tags for filtering (comma-separated, e.g. "frontend,typescript")'),
      force: z.boolean().optional().describe('Update if already registered (default: false)'),
    },
    async ({ path, alias, tags: tagsString, force }) => {
      logger.debug('Tool register_repository called', { path, alias, tags: tagsString, force })
      try {
        const tags = splitCommaSeparated(tagsString) || []
        const repo = await repoManager.register(path, { alias, tags, force })
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  action: repo._action || (force ? 'updated' : 'registered'),
                  repository: {
                    id: repo.id,
                    path: repo.path,
                    alias: repo.alias,
                    tags: repo.tags,
                    branch: repo.gitInfo.branch,
                    registeredAt: repo.registeredAt,
                  },
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

  server.tool(
    'repositories',
    'List, view, or remove registered repositories',
    {
      identifier: z.string().optional().describe('Get or remove a specific repo by ID, alias, or path'),
      remove: z.boolean().optional().describe('Remove the identified repository (requires identifier)'),
      tagFilter: z.string().optional().describe('Filter list by tags (comma-separated, e.g. "frontend,typescript")'),
    },
    async ({ identifier, remove, tagFilter }) => {
      logger.debug('Tool repositories called', { identifier, remove, tagFilter })
      try {
        // Validate: remove requires identifier
        if (remove && !identifier) {
          return {
            content: [{ type: 'text', text: 'Error: remove requires an identifier' }],
            isError: true,
          }
        }

        // Remove a specific repository
        if (identifier && remove) {
          await repoManager.unregister(identifier)
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, removed: identifier }),
              },
            ],
          }
        }

        // Get details of a specific repository
        if (identifier) {
          const repo = await repoManager.get(identifier)
          if (!repo) {
            return {
              content: [{ type: 'text', text: 'Repository not found' }],
              isError: true,
            }
          }
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(repo, null, 2),
              },
            ],
          }
        }

        // List all repositories (optionally filtered by tags)
        const tags = splitCommaSeparated(tagFilter)
        const repos = await repoManager.list({ tags })
        if (repos.length === 0) {
          return {
            content: [{ type: 'text', text: 'No repositories registered.' }],
          }
        }

        let output = `## Registered Repositories (${repos.length})\n\n`
        for (const r of repos) {
          output += `### ${r.alias || r.id}\n`
          output += `- **Path**: \`${r.path}\`\n`
          output += `- **Branch**: \`${r.gitInfo.branch}\`\n`
          if (r.tags && r.tags.length > 0) {
            output += `- **Tags**: ${r.tags.join(', ')}\n`
          }
          output += '\n'
        }

        return {
          content: [
            {
              type: 'text',
              text: output.trim(),
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
