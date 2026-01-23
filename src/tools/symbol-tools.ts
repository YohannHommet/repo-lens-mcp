import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { RepositoryManager } from '../core/repository-manager.js';
import { SymbolSearchEngine } from '../search/symbol-search.js';
import { SearchCache } from '../utils/cache.js';
import { ServerConfig } from '../config/types.js';

export function registerSymbolTools(
  server: McpServer,
  repoManager: RepositoryManager,
  symbolSearch: SymbolSearchEngine,
  searchCache: SearchCache<any>,
  config: ServerConfig
) {
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

        // Check cache
        const cacheKey = searchCache.generateKey('symbol:function', {
          name,
          repos: repositories.map((r) => r.id).sort(),
          language,
          exportedOnly,
          maxResults,
        });

        if (config.cacheEnabled) {
          const cached = searchCache.get(cacheKey);
          if (cached) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      totalFound: (cached as any[]).length,
                      functions: (cached as any[]).map((r) => ({
                        name: r.name,
                        repository: r.repositoryAlias || r.repository,
                        file: r.relativePath,
                        lines: { start: r.startLine, end: r.endLine },
                        signature: r.signature,
                        exported: r.exported,
                      })),
                      cached: true,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }
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

        if (config.cacheEnabled) {
          searchCache.set(cacheKey, results);
        }

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

        // Check cache
        const cacheKey = searchCache.generateKey('symbol:class', {
          name,
          repos: repositories.map((r) => r.id).sort(),
          language,
          exportedOnly,
          maxResults,
        });

        if (config.cacheEnabled) {
          const cached = searchCache.get(cacheKey);
          if (cached) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      totalFound: (cached as any[]).length,
                      classes: (cached as any[]).map((r) => ({
                        name: r.name,
                        repository: r.repositoryAlias || r.repository,
                        file: r.relativePath,
                        lines: { start: r.startLine, end: r.endLine },
                        signature: r.signature,
                        exported: r.exported,
                      })),
                      cached: true,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }
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

        if (config.cacheEnabled) {
          searchCache.set(cacheKey, results);
        }

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

        // Check cache
        const cacheKey = searchCache.generateKey('symbol:types', {
          name,
          repos: repositories.map((r) => r.id).sort(),
          language,
          exportedOnly,
          maxResults,
        });

        if (config.cacheEnabled) {
          const cached = searchCache.get(cacheKey);
          if (cached) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      totalFound: (cached as any[]).length,
                      types: (cached as any[]).map((r) => ({
                        name: r.name,
                        kind: r.kind,
                        repository: r.repositoryAlias || r.repository,
                        file: r.relativePath,
                        lines: { start: r.startLine, end: r.endLine },
                        signature: r.signature,
                        exported: r.exported,
                      })),
                      cached: true,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }
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

        if (config.cacheEnabled) {
          searchCache.set(cacheKey, results);
        }

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

  server.tool(
    'find_enums',
    'Find enum definitions across repositories using AST analysis',
    {
      name: z.string().optional().describe('Enum name pattern'),
      repos: z.array(z.string()).optional().describe('Repository identifiers to search'),
      language: z.string().optional().describe('Filter by language'),
      exportedOnly: z.boolean().optional().describe('Only return exported enums'),
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

        // Check cache
        const cacheKey = searchCache.generateKey('symbol:enum', {
          name,
          repos: repositories.map((r) => r.id).sort(),
          language,
          exportedOnly,
          maxResults,
        });

        if (config.cacheEnabled) {
          const cached = searchCache.get(cacheKey);
          if (cached) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      totalFound: (cached as any[]).length,
                      enums: (cached as any[]).map((r) => ({
                        name: r.name,
                        repository: r.repositoryAlias || r.repository,
                        file: r.relativePath,
                        lines: { start: r.startLine, end: r.endLine },
                        signature: r.signature,
                        exported: r.exported,
                      })),
                      cached: true,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }
        }

        const results = await symbolSearch.search(
          {
            kind: 'enum',
            name,
            language,
            exportedOnly: exportedOnly ?? false,
            maxResults: maxResults ?? 100,
          },
          repositories
        );

        if (config.cacheEnabled) {
          searchCache.set(cacheKey, results);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  totalFound: results.length,
                  enums: results.map((r) => ({
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
    'find_variables',
    'Find variable declarations across repositories using AST analysis',
    {
      name: z.string().optional().describe('Variable name pattern'),
      repos: z.array(z.string()).optional().describe('Repository identifiers to search'),
      language: z.string().optional().describe('Filter by language'),
      exportedOnly: z.boolean().optional().describe('Only return exported variables'),
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

        // Check cache
        const cacheKey = searchCache.generateKey('symbol:variable', {
          name,
          repos: repositories.map((r) => r.id).sort(),
          language,
          exportedOnly,
          maxResults,
        });

        if (config.cacheEnabled) {
          const cached = searchCache.get(cacheKey);
          if (cached) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      totalFound: (cached as any[]).length,
                      variables: (cached as any[]).map((r) => ({
                        name: r.name,
                        repository: r.repositoryAlias || r.repository,
                        file: r.relativePath,
                        lines: { start: r.startLine, end: r.endLine },
                        signature: r.signature,
                        exported: r.exported,
                      })),
                      cached: true,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }
        }

        const results = await symbolSearch.search(
          {
            kind: 'variable',
            name,
            language,
            exportedOnly: exportedOnly ?? false,
            maxResults: maxResults ?? 100,
          },
          repositories
        );

        if (config.cacheEnabled) {
          searchCache.set(cacheKey, results);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  totalFound: results.length,
                  variables: results.map((r) => ({
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
    'find_constants',
    'Find constant declarations across repositories using AST analysis',
    {
      name: z.string().optional().describe('Constant name pattern'),
      repos: z.array(z.string()).optional().describe('Repository identifiers to search'),
      language: z.string().optional().describe('Filter by language'),
      exportedOnly: z.boolean().optional().describe('Only return exported constants'),
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

        // Check cache
        const cacheKey = searchCache.generateKey('symbol:constant', {
          name,
          repos: repositories.map((r) => r.id).sort(),
          language,
          exportedOnly,
          maxResults,
        });

        if (config.cacheEnabled) {
          const cached = searchCache.get(cacheKey);
          if (cached) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      totalFound: (cached as any[]).length,
                      constants: (cached as any[]).map((r) => ({
                        name: r.name,
                        repository: r.repositoryAlias || r.repository,
                        file: r.relativePath,
                        lines: { start: r.startLine, end: r.endLine },
                        signature: r.signature,
                        exported: r.exported,
                      })),
                      cached: true,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }
        }

        const results = await symbolSearch.search(
          {
            kind: 'constant',
            name,
            language,
            exportedOnly: exportedOnly ?? false,
            maxResults: maxResults ?? 100,
          },
          repositories
        );

        if (config.cacheEnabled) {
          searchCache.set(cacheKey, results);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  totalFound: results.length,
                  constants: results.map((r) => ({
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
}
