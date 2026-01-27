import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { RepositoryManager } from '../core/repository-manager.js'
import type { SearchCache } from '../utils/cache.js'
import { z } from 'zod'
import { logger } from '../utils/logger.js'
import { splitCommaSeparated } from '../utils/string-utils.js'

export function registerRepositoryTools(
  server: McpServer,
  repoManager: RepositoryManager,
  searchCache: SearchCache<any>,
) {
  server.tool(
    'register_repository',
    'Register a local git repository for searching across projects',
    {
      path: z.string().describe('Absolute path to the git repository'),
      alias: z.string().optional().describe('User-friendly name for the repository'),
      tags: z.string().optional().describe('Tags for filtering (comma-separated, e.g. "frontend,typescript")'),
    },
    async ({ path, alias, tags: tagsString }) => {
      logger.debug('Tool register_repository called', { path, alias, tags: tagsString })
      try {
        const tags = splitCommaSeparated(tagsString) || []
        const repo = await repoManager.register(path, { alias, tags })
        searchCache.clear()
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  repository: {
                    id: repo.id,
                    path: repo.path,
                    alias: repo.alias,
                    tags: repo.tags,
                    languages: repo.languages,
                    fileCount: repo.fileCount,
                    branch: repo.gitInfo.branch,
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
    'unregister_repository',
    'Remove a repository from the search pool',
    {
      identifier: z.string().describe('Repository ID, alias, or path'),
    },
    async ({ identifier }) => {
      try {
        await repoManager.unregister(identifier)
        searchCache.clear()
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true }) }],
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
    'list_registered_repositories',
    'List all registered repositories in the search index',
    {
      tagFilter: z.string().optional().describe('Filter by tags (comma-separated, e.g. "frontend,typescript")'),
    },
    async ({ tagFilter }) => {
      logger.debug('Tool list_registered_repositories called', { tagFilter })
      try {
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
          output += `- **Files**: ${r.fileCount}\n`
          output += `- **Languages**: ${r.languages.join(', ')}\n`
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

  server.tool(
    'get_repository_info',
    'Get detailed information about a repository',
    {
      identifier: z.string().describe('Repository ID, alias, or path'),
    },
    async ({ identifier }) => {
      try {
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
      catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${(error as Error).message}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'refresh_repository',
    'Re-scan a repository to update metadata',
    {
      identifier: z.string().describe('Repository ID, alias, or path'),
    },
    async ({ identifier }) => {
      try {
        const repo = await repoManager.refresh(identifier)

        // Invalidate cache as repo content changed
        searchCache.clear()

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  repository: {
                    id: repo.id,
                    languages: repo.languages,
                    fileCount: repo.fileCount,
                    branch: repo.gitInfo.branch,
                    lastCommit: repo.gitInfo.lastCommit,
                    lastScanned: repo.lastScanned,
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
}
