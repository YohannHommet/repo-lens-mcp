#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { loadConfig } from './config/index.js';
import { RepositoryManager } from './core/repository-manager.js';
import { TextSearchEngine } from './search/text-search.js';
import { SymbolSearchEngine } from './search/symbol-search.js';
import { FileSearchEngine } from './search/file-search.js';
import { logger } from './utils/logger.js';

const config = loadConfig();
logger.setLevel(config.logLevel);

const repoManager = new RepositoryManager(config.configDir);
const textSearch = new TextSearchEngine(config.searchTimeout);
const symbolSearch = new SymbolSearchEngine();
const fileSearch = new FileSearchEngine();

const server = new McpServer({
  name: 'mcp-repo-search-server',
  version: '1.0.0',
});

// ==================== Repository Management Tools ====================

server.tool(
  'register_repository',
  'Register a local git repository for searching across projects',
  {
    path: z.string().describe('Absolute path to the git repository'),
    alias: z.string().optional().describe('User-friendly name for the repository'),
    tags: z.array(z.string()).optional().describe("Tags for filtering (e.g., ['frontend', 'typescript'])"),
  },
  async ({ path, alias, tags }) => {
    try {
      const repo = await repoManager.register(path, { alias, tags });
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

server.tool(
  'unregister_repository',
  'Remove a repository from the search pool',
  {
    identifier: z.string().describe('Repository ID, alias, or path'),
  },
  async ({ identifier }) => {
    try {
      await repoManager.unregister(identifier);
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true }) }],
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
  'list_repositories',
  'List all registered repositories',
  {
    tags: z.array(z.string()).optional().describe('Filter by tags'),
  },
  async ({ tags }) => {
    try {
      const repos = await repoManager.list({ tags });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                count: repos.length,
                repositories: repos.map((r) => ({
                  id: r.id,
                  path: r.path,
                  alias: r.alias,
                  tags: r.tags,
                  languages: r.languages,
                  fileCount: r.fileCount,
                  branch: r.gitInfo.branch,
                  lastScanned: r.lastScanned,
                })),
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

server.tool(
  'get_repository_info',
  'Get detailed information about a repository',
  {
    identifier: z.string().describe('Repository ID, alias, or path'),
  },
  async ({ identifier }) => {
    try {
      const repo = await repoManager.get(identifier);
      if (!repo) {
        return {
          content: [{ type: 'text', text: 'Repository not found' }],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(repo, null, 2),
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
  'refresh_repository',
  'Re-scan a repository to update metadata',
  {
    identifier: z.string().describe('Repository ID, alias, or path'),
  },
  async ({ identifier }) => {
    try {
      const repo = await repoManager.refresh(identifier);
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

// ==================== Text Search Tools ====================

server.tool(
  'search_text',
  'Search for text pattern across all registered repositories using ripgrep',
  {
    pattern: z.string().describe('Search pattern (supports regex)'),
    repos: z
      .array(z.string())
      .optional()
      .describe('Repository identifiers to search (paths or aliases). Searches all if not specified.'),
    glob: z.string().optional().describe("File glob pattern (e.g., '*.ts', '**/*.{js,jsx}')"),
    caseSensitive: z.boolean().optional().describe('Case-sensitive search (default: false)'),
    wholeWord: z.boolean().optional().describe('Match whole words only (default: false)'),
    maxResults: z.number().optional().describe('Maximum results (default: 100)'),
    contextLines: z.number().optional().describe('Lines of context around matches (default: 0)'),
  },
  async ({ pattern, repos, glob, caseSensitive, wholeWord, maxResults, contextLines }) => {
    try {
      const repositories = repoManager.resolveIdentifiers(repos);

      if (repositories.length === 0) {
        return {
          content: [{ type: 'text', text: 'No repositories found. Register repositories first.' }],
          isError: true,
        };
      }

      const results = await textSearch.search(
        {
          pattern,
          glob,
          caseSensitive: caseSensitive ?? false,
          wholeWord: wholeWord ?? false,
          maxResults: maxResults ?? 100,
          contextLines: contextLines ?? 0,
        },
        repositories
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                totalMatches: results.length,
                results: results.map((r) => ({
                  repository: r.repositoryAlias || r.repository,
                  file: r.relativePath,
                  line: r.lineNumber,
                  column: r.columnNumber,
                  content: r.lineContent,
                })),
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

// ==================== Symbol Search Tools ====================

server.tool(
  'find_functions',
  'Find function/method definitions across repositories using AST analysis',
  {
    name: z.string().optional().describe("Function name pattern (supports wildcards like 'handle*')"),
    repos: z.array(z.string()).optional().describe('Repository identifiers to search'),
    language: z.string().optional().describe('Filter by language (typescript, javascript)'),
    exportedOnly: z.boolean().optional().describe('Only return exported functions (default: false)'),
    maxResults: z.number().optional().describe('Maximum results (default: 100)'),
  },
  async ({ name, repos, language, exportedOnly, maxResults }) => {
    try {
      const repositories = repoManager.resolveIdentifiers(repos);

      if (repositories.length === 0) {
        return {
          content: [{ type: 'text', text: 'No repositories found. Register repositories first.' }],
          isError: true,
        };
      }

      const results = await symbolSearch.search(
        {
          kind: 'function',
          name,
          language,
          exportedOnly: exportedOnly ?? false,
          maxResults: maxResults ?? 100,
        },
        repositories
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                totalFound: results.length,
                functions: results.map((r) => ({
                  name: r.name,
                  repository: r.repositoryAlias || r.repository,
                  file: r.relativePath,
                  lines: { start: r.startLine, end: r.endLine },
                  signature: r.signature,
                  exported: r.exported,
                })),
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

server.tool(
  'find_classes',
  'Find class definitions across repositories using AST analysis',
  {
    name: z.string().optional().describe('Class name pattern'),
    repos: z.array(z.string()).optional().describe('Repository identifiers to search'),
    language: z.string().optional().describe('Filter by language'),
    exportedOnly: z.boolean().optional().describe('Only return exported classes'),
    maxResults: z.number().optional().describe('Maximum results'),
  },
  async ({ name, repos, language, exportedOnly, maxResults }) => {
    try {
      const repositories = repoManager.resolveIdentifiers(repos);

      if (repositories.length === 0) {
        return {
          content: [{ type: 'text', text: 'No repositories found.' }],
          isError: true,
        };
      }

      const results = await symbolSearch.search(
        {
          kind: 'class',
          name,
          language,
          exportedOnly: exportedOnly ?? false,
          maxResults: maxResults ?? 100,
        },
        repositories
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                totalFound: results.length,
                classes: results.map((r) => ({
                  name: r.name,
                  repository: r.repositoryAlias || r.repository,
                  file: r.relativePath,
                  lines: { start: r.startLine, end: r.endLine },
                  signature: r.signature,
                  exported: r.exported,
                })),
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

server.tool(
  'find_types',
  'Find type/interface definitions across repositories using AST analysis',
  {
    name: z.string().optional().describe('Type name pattern'),
    repos: z.array(z.string()).optional().describe('Repository identifiers to search'),
    language: z.string().optional().describe('Filter by language'),
    exportedOnly: z.boolean().optional().describe('Only return exported types'),
    maxResults: z.number().optional().describe('Maximum results'),
  },
  async ({ name, repos, language, exportedOnly, maxResults }) => {
    try {
      const repositories = repoManager.resolveIdentifiers(repos);

      if (repositories.length === 0) {
        return {
          content: [{ type: 'text', text: 'No repositories found.' }],
          isError: true,
        };
      }

      // Search both types and interfaces
      const [typeResults, interfaceResults] = await Promise.all([
        symbolSearch.search(
          { kind: 'type', name, language, exportedOnly: exportedOnly ?? false, maxResults: maxResults ?? 50 },
          repositories
        ),
        symbolSearch.search(
          { kind: 'interface', name, language, exportedOnly: exportedOnly ?? false, maxResults: maxResults ?? 50 },
          repositories
        ),
      ]);

      const results = [...typeResults, ...interfaceResults];

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                totalFound: results.length,
                types: results.map((r) => ({
                  name: r.name,
                  kind: r.kind,
                  repository: r.repositoryAlias || r.repository,
                  file: r.relativePath,
                  lines: { start: r.startLine, end: r.endLine },
                  signature: r.signature,
                  exported: r.exported,
                })),
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

// ==================== File Tools ====================

server.tool(
  'get_file',
  'Retrieve file contents from any registered repository',
  {
    filePath: z.string().describe('Absolute path to the file'),
    startLine: z.number().optional().describe('Start reading from this line (1-indexed)'),
    endLine: z.number().optional().describe('Stop reading at this line (inclusive)'),
  },
  async ({ filePath, startLine, endLine }) => {
    try {
      const resolved = repoManager.resolvePath(filePath);
      if (!resolved) {
        return {
          content: [{ type: 'text', text: 'Error: File is not within a registered repository' }],
          isError: true,
        };
      }

      const { content, totalLines } = await fileSearch.getFile(resolved.repo, filePath, startLine, endLine);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                repository: resolved.repo.alias || resolved.repo.path,
                relativePath: resolved.relativePath,
                totalLines,
                lineRange: startLine || endLine ? { start: startLine ?? 1, end: endLine ?? totalLines } : undefined,
                content,
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

server.tool(
  'list_files',
  'List files in a repository path',
  {
    repoIdentifier: z.string().describe('Repository ID, alias, or path'),
    path: z.string().optional().describe('Subdirectory path within the repository'),
    glob: z.string().optional().describe("File glob pattern (e.g., '*.ts')"),
    recursive: z.boolean().optional().describe('Search recursively (default: true)'),
  },
  async ({ repoIdentifier, path, glob, recursive }) => {
    try {
      const repo = repoManager.resolveIdentifier(repoIdentifier);
      if (!repo) {
        return {
          content: [{ type: 'text', text: 'Repository not found' }],
          isError: true,
        };
      }

      const files = await fileSearch.listFiles(repo, path, glob, recursive ?? true);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                repository: repo.alias || repo.path,
                count: files.length,
                files: files.map((f) => f.relativePath),
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

server.tool(
  'search_files',
  'Find files by name pattern across repositories',
  {
    pattern: z.string().describe("File name pattern (e.g., '*Controller*', '*.service.ts')"),
    repos: z.array(z.string()).optional().describe('Repository identifiers to search'),
    maxResults: z.number().optional().describe('Maximum results (default: 100)'),
  },
  async ({ pattern, repos, maxResults }) => {
    try {
      const repositories = repoManager.resolveIdentifiers(repos);

      if (repositories.length === 0) {
        return {
          content: [{ type: 'text', text: 'No repositories found.' }],
          isError: true,
        };
      }

      const results = await fileSearch.search(
        {
          pattern,
          maxResults: maxResults ?? 100,
        },
        repositories
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                totalFound: results.length,
                files: results.map((r) => ({
                  repository: r.repositoryAlias || r.repository,
                  path: r.relativePath,
                  fullPath: r.filePath,
                })),
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

server.tool(
  'get_file_info',
  'Get metadata about a file',
  {
    filePath: z.string().describe('Absolute path to the file'),
  },
  async ({ filePath }) => {
    try {
      const resolved = repoManager.resolvePath(filePath);
      if (!resolved) {
        return {
          content: [{ type: 'text', text: 'Error: File is not within a registered repository' }],
          isError: true,
        };
      }

      const info = await fileSearch.getFileInfo(resolved.repo, filePath);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                repository: resolved.repo.alias || resolved.repo.path,
                ...info,
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

// ==================== Project Structure Tool ====================

server.tool(
  'get_project_structure',
  'Get an overview of a repository structure',
  {
    repoIdentifier: z.string().describe('Repository ID, alias, or path'),
    depth: z.number().optional().describe('Maximum depth to traverse (default: 3)'),
  },
  async ({ repoIdentifier, depth }) => {
    try {
      const repo = repoManager.resolveIdentifier(repoIdentifier);
      if (!repo) {
        return {
          content: [{ type: 'text', text: 'Repository not found' }],
          isError: true,
        };
      }

      const files = await fileSearch.listFiles(repo, undefined, '**/*', true);
      const maxDepth = depth ?? 3;

      // Build directory tree
      const tree: Record<string, string[]> = {};
      for (const file of files) {
        const parts = file.relativePath.split('/');
        if (parts.length <= maxDepth) {
          const dir = parts.slice(0, -1).join('/') || '.';
          if (!tree[dir]) tree[dir] = [];
          tree[dir].push(parts[parts.length - 1]);
        }
      }

      // Summarize
      const summary = {
        repository: repo.alias || repo.path,
        languages: repo.languages,
        totalFiles: repo.fileCount,
        branch: repo.gitInfo.branch,
        directories: Object.keys(tree).length,
        structure: tree,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(summary, null, 2),
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

// ==================== Server Startup ====================

async function main(): Promise<void> {
  await repoManager.load();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('MCP Repo Search Server started', {
    configDir: config.configDir,
    repositoryCount: (await repoManager.list()).length,
  });
}

process.on('SIGINT', async () => {
  await repoManager.save();
  logger.info('Server shutting down');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await repoManager.save();
  logger.info('Server shutting down');
  process.exit(0);
});

main().catch((error) => {
  logger.error('Server failed to start', { error });
  process.exit(1);
});
