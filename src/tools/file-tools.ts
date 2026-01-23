import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { RepositoryManager } from '../core/repository-manager.js';
import { FileSearchEngine } from '../search/file-search.js';

export function registerFileTools(
    server: McpServer,
    repoManager: RepositoryManager,
    fileSearch: FileSearchEngine
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
                const resolved = repoManager.resolvePath(filePath);
                if (!resolved) {
                    return {
                        content: [{ type: 'text', text: 'File path is not within any registered repository' }],
                        isError: true,
                    };
                }

                const { repo } = resolved;
                const result = await fileSearch.getFile(repo, filePath, startLine, endLine);

                return {
                    content: [
                        {
                            type: 'text',
                            text: result.content,
                        },
                    ],
                };
            } catch (error) {
                return {
                    content: [{ type: 'text', text: `Error: ${(error as Error).message}` }],
                    isError: true,
                };
            }
        }
    );

    server.tool(
        'get_file_info',
        'Get metadata about a file',
        {
            filePath: z.string().describe('Absolute path to the file'),
        },
        async ({ filePath }) => {
            try {
                // Validate path is within a registered repository
                const resolved = repoManager.resolvePath(filePath);
                if (!resolved) {
                    return {
                        content: [{ type: 'text', text: 'File path is not within any registered repository' }],
                        isError: true,
                    };
                }

                const { repo, relativePath } = resolved;
                const info = await fileSearch.getFileInfo(repo, filePath);

                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(
                                {
                                    ...info,
                                    repository: repo.alias || repo.id,
                                    relativePath,
                                },
                                null,
                                2
                            ),
                        },
                    ],
                };
            } catch (error) {
                return {
                    content: [{ type: 'text', text: `Error: ${(error as Error).message}` }],
                    isError: true,
                };
            }
        }
    );
}
