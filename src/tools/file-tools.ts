import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { RepositoryManager } from '../core/repository-manager.js'
import type { FileSearchEngine } from '../search/file-search.js'
import { z } from 'zod'
import { getLanguageForFile } from '../utils/path-utils.js'

export function registerFileTools(
  server: McpServer,
  repoManager: RepositoryManager,
  fileSearch: FileSearchEngine,
) {
  server.tool(
    'get_file',
    'Retrieve file contents from any registered repository',
    {
      filePath: z.string().describe('Absolute path to the file'),
      startLine: z.number().optional().describe('Start reading from this line (1-indexed)'),
      endLine: z.number().optional().describe('End reading at this line (1-indexed)'),
    },
    async ({ filePath, startLine, endLine }) => {
      try {
        // Validate path is within a registered repository
        const resolved = repoManager.resolvePath(filePath)
        if (!resolved) {
          return {
            content: [{ type: 'text', text: 'File path is not within any registered repository' }],
            isError: true,
          }
        }

        const { repo, relativePath } = resolved
        const result = await fileSearch.getFile(repo, filePath, startLine, endLine)
        const language = getLanguageForFile(filePath)
        const lineInfo = (startLine || endLine) ? ` (lines ${startLine || 1}-${endLine || 'end'})` : ''

        return {
          content: [
            {
              type: 'text',
              text: `### ${repo.alias || repo.id}:${relativePath}${lineInfo}\n\n\`\`\`${language}\n${result.content}\n\`\`\``,
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
    'get_file_info',
    'Get metadata about a file',
    {
      filePath: z.string().describe('Absolute path to the file'),
    },
    async ({ filePath }) => {
      try {
        // Validate path is within a registered repository
        const resolved = repoManager.resolvePath(filePath)
        if (!resolved) {
          return {
            content: [{ type: 'text', text: 'File path is not within any registered repository' }],
            isError: true,
          }
        }

        const { repo, relativePath } = resolved
        const info = await fileSearch.getFileInfo(repo, filePath)

        return {
          content: [
            {
              type: 'text',
              text: `## File Information: ${relativePath}\n`
                + `- **Repository**: ${repo.alias || repo.id}\n`
                + `- **Size**: ${info.size} bytes\n`
                + `- **Language**: ${info.language}\n`
                + `- **Last Modified**: ${info.modified.toLocaleString()}\n`
                + `- **Absolute Path**: \`${filePath}\``,
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
