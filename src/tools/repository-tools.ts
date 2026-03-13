import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { RepositoryManager } from '../core/repository-manager.js'
import { z } from 'zod'
import { logger } from '../utils/logger.js'
import { splitCommaSeparated } from '../utils/string-utils.js'

export function registerRepositoryTools(
  server: McpServer,
  repoManager: RepositoryManager,
) {
  server.registerTool(
    'repolens_register_repository',
    {
      title: 'Register Repository',
      description: `Register a local git repository for cross-repository symbol search.

This tool adds a git repository to the search index, enabling AST-based symbol search across multiple codebases. The repository must be a valid git repository.

Args:
  - path (string, required): Absolute path to the git repository root
  - alias (string, optional): Human-friendly name for quick reference (e.g., "backend", "frontend")
  - tags (string, optional): Comma-separated tags for filtering (e.g., "frontend,typescript")
  - force (boolean, optional): If true, updates existing registration (default: false)
  - response_format (string, optional): Output format - "markdown" (default, human-readable) or "json" (machine-readable)

Returns:
  Markdown: "Registered: <name> -> <path> (<branch>) [tags]"
  JSON: Full repository object with id, path, alias, tags, gitInfo, action

Examples:
  - Register with alias: path="/home/user/projects/api", alias="backend-api"
  - Register with tags: path="/home/user/projects/web", tags="frontend,react,typescript"
  - Update existing: path="/home/user/projects/api", force=true, tags="backend,node"

Error Handling:
  - "Not a git repository" if path is not a valid git repo
  - "Repository already registered" if path exists and force=false
  - "Alias already in use" if alias is taken by another repository`,
      inputSchema: z.object({
        path: z.string().min(1).describe('Absolute path to the git repository'),
        alias: z.string().min(1).optional().describe('User-friendly name for the repository'),
        tags: z.string().optional().describe('Tags for filtering (comma-separated, e.g. "frontend,typescript")'),
        force: z.boolean().optional().describe('Update if already registered (default: false)'),
        response_format: z.enum(['json', 'markdown']).optional().describe('Output format: "markdown" (default) or "json"'),
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ path, alias, tags: tagsString, force, response_format }) => {
      logger.debug('Tool register_repository called', { path, alias, tags: tagsString, force, response_format })
      try {
        const tags = splitCommaSeparated(tagsString) || []
        const repo = await repoManager.register(path, { alias, tags, force })

        // JSON format - return full repository object
        if (response_format === 'json') {
          return {
            content: [{ type: 'text', text: JSON.stringify(repo, null, 2) }],
          }
        }

        // Markdown format (default) - token-efficient response
        const name = repo.alias || repo.id.slice(0, 8)
        const tagsStr = repo.tags?.length ? ` [${repo.tags.join(',')}]` : ''
        return {
          content: [
            {
              type: 'text',
              text: `${repo.action === 'updated' ? 'Updated' : 'Registered'}: ${name} -> ${repo.path} (${repo.gitInfo.branch})${tagsStr}`,
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

  server.registerTool(
    'repolens_repositories',
    {
      title: 'Manage Repositories',
      description: `List, view details, or remove registered repositories.

This tool provides three operations depending on parameters:
1. List all repositories (no params or tagFilter only)
2. Get details of one repository (identifier only)
3. Remove a repository (identifier + remove=true)

Args:
  - identifier (string, optional): Repository ID, alias, or absolute path to look up or remove
  - remove (boolean, optional): If true, removes the identified repository (requires identifier)
  - tagFilter (string, optional): Comma-separated tags to filter the list (e.g., "frontend,typescript")
  - response_format (string, optional): Output format - "markdown" (default) or "json"

Returns:
  List mode (markdown): "<count> repositories:\\n  <name>: <path> (<branch>) [tags]"
  List mode (json): Array of repository objects
  Get mode: Full JSON object (both formats)
  Remove mode: {"success": true, "removed": "<identifier>"} (both formats)

Examples:
  - List all: {} (empty params)
  - Filter by tags: tagFilter="backend,typescript"
  - Get details: identifier="backend-api" or identifier="/home/user/projects/api"
  - Remove repo: identifier="backend-api", remove=true

Error Handling:
  - "Repository not found" when identifier doesn't match any registered repo
  - "remove requires an identifier" when remove=true but no identifier provided`,
      inputSchema: z.object({
        identifier: z.string().min(1).optional().describe('Get or remove a specific repo by ID, alias, or path'),
        remove: z.boolean().optional().describe('Remove the identified repository (requires identifier)'),
        tagFilter: z.string().optional().describe('Filter list by tags (comma-separated, e.g. "frontend,typescript")'),
        response_format: z.enum(['json', 'markdown']).optional().describe('Output format: "markdown" (default) or "json"'),
      }).strict(),
      annotations: {
        readOnlyHint: false, // Can remove repos
        destructiveHint: true, // Remove is destructive
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ identifier, remove, tagFilter, response_format }) => {
      logger.debug('Tool repositories called', { identifier, remove, tagFilter, response_format })
      try {
        // Validate: remove requires identifier
        if (remove && !identifier) {
          return {
            content: [{ type: 'text', text: 'Error: "remove" requires an "identifier" to specify which repository to remove' }],
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
          const repo = repoManager.get(identifier)
          if (!repo) {
            return {
              content: [{ type: 'text', text: `Repository not found: "${identifier}". Use repolens_repositories without params to list all registered repositories.` }],
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
        const repos = repoManager.list({ tags })
        if (repos.length === 0) {
          return {
            content: [{ type: 'text', text: response_format === 'json' ? '[]' : 'No repositories registered.' }],
          }
        }

        // JSON format - return array of repositories
        if (response_format === 'json') {
          return {
            content: [{ type: 'text', text: JSON.stringify(repos, null, 2) }],
          }
        }

        // Markdown format (default) - token-efficient format
        const lines: string[] = [`${repos.length} repositories:`]
        for (const r of repos) {
          const name = r.alias || r.id.slice(0, 8)
          const tagsStr = r.tags?.length ? ` [${r.tags.join(',')}]` : ''
          lines.push(`  ${name}: ${r.path} (${r.gitInfo.branch})${tagsStr}`)
        }

        return {
          content: [
            {
              type: 'text',
              text: lines.join('\n'),
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
