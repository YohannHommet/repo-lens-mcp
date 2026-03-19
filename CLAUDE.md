# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

repo-lens-mcp is an MCP (Model Context Protocol) server that provides AST-based code search across multiple git repositories. It uses ast-grep (Rust-based) for structural pattern matching — not text search.

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm build` | Build with tsdown |
| `pnpm start` | Run built server (`node dist/index.mjs`) |
| `pnpm dev` | Watch mode (tsdown --watch) |
| `pnpm test` | Run tests (vitest) |
| `pnpm test -- --run src/tools/repository-tools.spec.ts` | Run a single test file |
| `pnpm test:coverage` | Tests with v8 coverage |
| `pnpm lint` | Lint with oxlint |
| `pnpm lint:fix` | Auto-fix lint issues |
| `pnpm typecheck` | Type check (oxlint-based) |
| `pnpm ci` | Full CI: test + typecheck + lint |
| `pnpm benchmark` | Single-repo benchmark |
| `pnpm benchmark:multi` | Multi-repo benchmark |

> **Note:** `pnpm typecheck` uses `oxlint --type-aware --type-check` for type-aware linting with TypeScript compiler diagnostics.

## Architecture

### MCP Tools (5 total)

All tools are prefixed with `repolens_` and registered via `server.registerTool()`:

- **Repository listing** (`src/tools/repository-tools.ts`): `repolens_list_repositories` (read-only)
- **Symbol search** (`src/tools/symbol-tools.ts`): `repolens_find_functions`, `repolens_find_classes`, `repolens_find_types`
- **API route search** (`src/tools/api-tools.ts`): `repolens_find_api_routes`

All 4 search tools accept a `paths` parameter for ad-hoc directory search without registration, plus `repoFilter` for filtering registered repos.

### Core Flow

```
MCP request → StdioServerTransport → McpServer routes to tool handler
→ Zod schema validation → resolveRepositories (registered + ad-hoc paths, deduplicated)
→ Search engine (Symbol or APIRoute) processes in parallel
→ Format as markdown (default, token-efficient) or JSON → MCP response
```

### Configuration

Repositories are declared in a static YAML config file (`repolens.yaml`):

```yaml
repositories:
  - path: ~/projects/backend
    alias: backend
  - path: ~/projects/frontend
    alias: frontend
```

Config path resolution: `--config` CLI arg > default `~/.config/repo-lens-mcp/repolens.yaml`.

### Key Components

- **`src/index.ts`**: Entry point — registers PHP dynamic language, creates ConfigLoader, initializes RepositoryManager, search engines, registers tools, connects stdio transport
- **`src/core/config-loader.ts`**: Read-only YAML config loader. Parses `repolens.yaml` with Zod validation, expands `~` in paths. If explicit `--config` path doesn't exist → fails hard. If default path doesn't exist → returns `[]` (ad-hoc paths still work).
- **`src/core/repository-manager.ts`**: In-memory repo registry loaded from ConfigLoader. Methods: `list()`, `get(identifier)`, `resolveIdentifier()`, `resolveIdentifiers()`, `createAdHocRepositories(paths)`. IDs are normalized paths (deterministic).
- **`src/core/repository-scanner.ts`**: Validates paths (must be directory + git repo) and scans git info (branch, lastCommit, remote) via `simple-git`.
- **`src/parsers/language-registry.ts`**: Maps file extensions to ast-grep `Lang` values. Supports `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.php`. Used by both search engines to decide whether to parse a file.
- **`src/search/symbol-search.ts`**: AST-based symbol search using ast-grep for JS/TS and PHP. Processes repos in parallel, files via p-limit (concurrency 8). Content pre-filter skips AST parsing when searched name isn't in file. Supports multi-kind search (`kinds: ['type', 'interface']`) for single-pass queries. Language-aware export detection (JS/TS: `export` keyword; PHP: `private`/`protected` = not exported)
- **`src/search/api-route-search.ts`**: HTTP endpoint discovery for Express, Fastify, NestJS, Laravel. Uses cheap checks (extension → path indicators → content) before AST parsing. Files via p-limit (concurrency 8)
- **`src/tools/tool-utils.ts`**: Shared tool helpers — repo resolution (registered + ad-hoc paths with dedup), response formatting with CHARACTER_LIMIT truncation, error handling
- **`src/parsers/patterns/`**: ast-grep pattern definitions per language (TypeScript and PHP). PHP uses `@ast-grep/lang-php` dynamic language registered at startup in `src/index.ts`

### Caching

- Pattern regex cache (100 max) in SymbolSearchEngine for wildcard matching
- Export block cache per file to avoid repeated regex scans

## Conventions

- **ES modules only** — all imports use `.js` extensions
- **Logging to stderr** — stdout is reserved for MCP protocol JSON
- **Zod schemas** for all tool input validation
- **Response format**: tools return `{ content: [{type: 'text', text}], structuredContent?, isError? }` — markdown by default for token efficiency, `structuredContent` with `outputSchema` for typed structured responses
- **Error handling in tools**: all tool handlers should wrap their body in try/catch and use `handleToolError(error, toolName)` from `tool-utils.ts` for consistent error formatting and logging
- **oxlint** for linting (not eslint) — config in `.oxlintrc.json`
- **tsdown** for bundling (not tsc) — config in `tsdown.config.ts`

## Testing

- Framework: **Vitest** with globals enabled (`vitest.config.ts`)
- Pattern: mock dependencies → capture tool handlers via `server.registerTool` mock → call handlers directly → assert responses
- Test files: colocated as `*.spec.ts` in `src/tools/` and `src/core/`
- **Constructor-injected deps** (e.g. `ConfigLoader` into `RepositoryManager`): pass mock objects directly (`{ load: mockFn } as any`), don't use `vi.mock()` for the module — the real class is never instantiated internally

## Environment Variables

- `MCP_LOG_LEVEL`: Log verbosity (default: `info`)

## CLI Arguments

- `--config <path>`: Path to `repolens.yaml` config file (default: `~/.config/repo-lens-mcp/repolens.yaml`)

## CI/CD

- GitHub Actions workflow: `.github/workflows/publish.yml`
- Uses **pnpm** (not npm) — `packageManager` field in `package.json` drives `pnpm/action-setup@v4`
- Publish triggers on GitHub release event → npm publish with provenance
- `npm publish` (not `pnpm publish`) is used for the actual npm registry push

## Gotchas

- **WSL2 pnpm chmod errors** — `pnpm install` may fail with `EPERM: operation not permitted, chmod` on bin files. If `node_modules` files are owned by another user (e.g. `www-data` from Docker), fix with `sudo chown -R $(whoami) node_modules`. If vitest binary is missing after install, run directly: `node node_modules/vitest/vitest.mjs --run`
- **`existsSync` in ConfigLoader `load()` is acceptable** — it's used to decide behavior (fail hard vs. return empty) based on whether the config was explicitly requested via `--config`
- **stdout is reserved for MCP JSON** — all logging must go to stderr. The logger already does this via `console.error`, but never use `console.log` directly
- **PHP is a dynamic language** — `registerDynamicLanguage({ php: phpLang })` must run before any ast-grep parsing; it's called once at startup in `src/index.ts`
