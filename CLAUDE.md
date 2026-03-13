# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

repo-lens-mcp is an MCP (Model Context Protocol) server that provides AST-based code search across multiple git repositories. It uses ast-grep (Rust-based) for structural pattern matching — not text search.

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm build` | Build with tsdown |
| `pnpm dev` | Watch mode (tsx) |
| `pnpm test` | Run tests (vitest) |
| `pnpm test -- --run src/tools/repository-tools.spec.ts` | Run a single test file |
| `pnpm test:coverage` | Tests with v8 coverage |
| `pnpm lint` | Lint with oxlint |
| `pnpm lint:fix` | Auto-fix lint issues |
| `pnpm typecheck` | Type check (oxlint-based) |
| `pnpm ci` | Full CI: test + typecheck + lint |

## Architecture

### MCP Tools (6 total)

All tools are prefixed with `repolens_` and registered via `server.registerTool()`:

- **Repository management** (`src/tools/repository-tools.ts`): `repolens_register_repository`, `repolens_repositories`
- **Symbol search** (`src/tools/symbol-tools.ts`): `repolens_find_functions`, `repolens_find_classes`, `repolens_find_types`
- **API route search** (`src/tools/api-tools.ts`): `repolens_find_api_routes`

### Core Flow

```
MCP request → StdioServerTransport → McpServer routes to tool handler
→ Zod schema validation → RepositoryManager resolves repos
→ Search engine (Symbol or APIRoute) processes in parallel
→ Format as markdown (default, token-efficient) or JSON → MCP response
```

### Key Components

- **`src/index.ts`**: Entry point — initializes RepositoryManager, search engines, registers tools, connects stdio transport
- **`src/core/repository-manager.ts`**: In-memory repo registry with persistence via ConfigStore
- **`src/search/symbol-search.ts`**: AST-based symbol search using ast-grep. Processes repos in parallel, files via p-limit (concurrency 8). Content pre-filter skips AST parsing when searched name isn't in file. Supports multi-kind search (`kinds: ['type', 'interface']`) for single-pass queries
- **`src/search/api-route-search.ts`**: HTTP endpoint discovery for Express, Fastify, NestJS, Laravel. Uses cheap checks (extension → path indicators → content) before AST parsing. Files via p-limit (concurrency 8)
- **`src/tools/tool-utils.ts`**: Shared tool helpers — repo resolution, response formatting with CHARACTER_LIMIT truncation, error handling
- **`src/parsers/patterns/`**: ast-grep pattern definitions per language (currently TypeScript)
- **`src/core/config-store.ts`**: Persists repos to `~/.config/mcp-repo-search/repositories.json`

### Caching

- Pattern regex cache (100 max) in SymbolSearchEngine for wildcard matching
- Export block cache per file to avoid repeated regex scans

## Conventions

- **ES modules only** — all imports use `.js` extensions
- **Logging to stderr** — stdout is reserved for MCP protocol JSON
- **Zod schemas** for all tool input validation
- **Response format**: tools return `{ content: [{type: 'text', text}], structuredContent?, isError? }` — markdown by default for token efficiency, `structuredContent` with `outputSchema` for typed structured responses
- **oxlint** for linting (not eslint) — config in `.oxlintrc.json`
- **tsdown** for bundling (not tsc) — config in `tsdown.config.ts`

## Testing

- Framework: **Vitest** with globals enabled (`vitest.config.ts`)
- Pattern: mock dependencies → capture tool handlers via `server.registerTool` mock → call handlers directly → assert responses
- Test files: colocated as `*.spec.ts` in `src/tools/`

## Environment Variables

- `MCP_LOG_LEVEL`: Log verbosity (default: `info`)
- `MCP_REPO_SEARCH_CONFIG_DIR`: Config directory (default: `~/.config/mcp-repo-search`)
