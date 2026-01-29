# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**repo-lens-mcp** is a Model Context Protocol (MCP) server that provides intelligent repository search and code analysis capabilities. Unlike simple text search tools, it uses AST-based (Abstract Syntax Tree) parsing via `ast-grep` to provide structural code intelligence. Think of it as a smart layer between LLMs and codebases that understands code structure, not just text patterns.

The server is designed to help LLMs navigate and understand codebases by:
- Performing structural searches (find classes, functions, types, not just keywords)
- Mapping API routes across Express, NestJS, Fastify, and Laravel frameworks
- Fast text search using ripgrep
- Managing multiple repository contexts

## Development Commands

### Build & Run
```bash
npm run build              # Compile TypeScript to dist/
npm start                  # Run the compiled server (requires prior build)
npm run dev                # Development mode with hot reload using tsx
```

### Testing
```bash
npm test                   # Run tests in watch mode
npm run test:coverage      # Run tests with coverage report (text, json, html, lcov)
```

### Code Quality
```bash
npm run lint               # Check code with ESLint
npm run lint:fix           # Auto-fix ESLint issues
npm run typecheck          # Run TypeScript type checking without emitting files
npm run ci                 # Run full CI suite (test:coverage + typecheck + lint)
```

### Testing the Server
```bash
npx tsx scripts/test-server.ts    # Test the MCP server interactively
```

## Architecture

### Core Components

**Entry Point (src/index.ts)**
- Initializes the MCP server using `@modelcontextprotocol/sdk`
- Loads configuration and sets up logging
- Creates and wires together all search engines and managers
- Registers tool handlers (5 categories: repository, search, symbol, API, file)
- Handles graceful shutdown on SIGINT/SIGTERM

**Repository Manager (src/core/repository-manager.ts)**
- Manages the registry of repositories that can be searched
- Persists repository metadata via ConfigStore (stored in user config directory)
- Resolves repositories by ID, alias, or absolute path
- Scans repositories for metadata: git info, language distribution, file counts
- Provides path resolution to map absolute file paths back to repositories

**Search Engines**
The codebase has four specialized search engines:

1. **TextSearchEngine (src/search/text-search.ts)**
   - Wraps `ripgrep` for fast text search across files
   - Uses JSON output mode for structured results
   - Implements timeout with SIGKILL fallback
   - Ignores common directories (node_modules, dist, .git)

2. **SymbolSearchEngine (src/search/symbol-search.ts)**
   - AST-based structural code search for functions, classes, interfaces, types, variables, constants
   - Uses `@ast-grep/napi` to parse code into ASTs
   - Pattern matching is defined in `src/parsers/patterns/` (currently only TypeScript/JavaScript)
   - Detects export status using both AST ancestry checks and regex fallbacks
   - Deduplicates results and extracts signatures

3. **APIRouteSearchEngine (src/search/api-route-search.ts)**
   - Specialized search for API endpoint definitions
   - Supports Express, Fastify, NestJS (decorators), and Laravel (PHP facades)
   - Extracts HTTP method, path, handler name, and path parameters
   - Uses AST patterns to match framework-specific route registration patterns

4. **FileSearchEngine (src/search/file-search.ts)**
   - Basic file operations: read files, get metadata, list directories
   - Enforces security: validates paths, prevents symlink traversal
   - Supports line range reading for large files

**Language Registry (src/parsers/language-registry.ts)**
- Maps file extensions to ast-grep language types
- Currently supports: TypeScript (.ts, .tsx), JavaScript (.js, .jsx, .mjs, .cjs)
- PHP support is partial (for Laravel route detection only)

**AST Patterns (src/parsers/patterns/)**
- Defines ast-grep patterns for each symbol type
- `typescript.ts`: Contains patterns for functions, classes, interfaces, types, etc.
- Pattern syntax uses ast-grep's tree-sitter based matching (e.g., `function $NAME($$$) { $$$ }`)

**Caching (src/utils/cache.ts)**
- LRU cache for search results with configurable TTL
- Cache keys are hashed combinations of search parameters
- Disabled via `MCP_CACHE_ENABLED=false` environment variable

**Configuration (src/config/)**
- Loads config from environment variables
- Config directory: `~/.config/repo-lens-mcp/` (platform-specific)
- Environment variables: `MCP_CACHE_ENABLED`, `MCP_LOG_LEVEL`, `MCP_SEARCH_TIMEOUT_MS`

### Tool Registration Pattern

Tools are registered by category in `src/tools/`:
- `repository-tools.ts`: register/unregister/list repositories
- `search-tools.ts`: text search
- `symbol-tools.ts`: find functions, classes, types, variables, constants
- `api-tools.ts`: find API routes
- `file-tools.ts`: get file content, list directories

Each tool handler:
1. Validates input using Zod schemas
2. Resolves repository identifiers to Repository objects
3. Calls the appropriate search engine
4. Uses SearchCache for performance
5. Returns formatted results

### Key Types (src/types/)

**Repository (types/repository.ts)**
```typescript
{
  id: string              // UUID
  path: string            // Absolute path
  alias?: string          // Optional human-friendly name
  tags: string[]          // For filtering
  gitInfo?: GitInfo       // Branch, remote, commit
  languages: LanguageDistribution
  lastScanned: Date
  fileCount: number
}
```

**SymbolResult (types/symbols.ts)**
```typescript
{
  repository: string // Repo ID
  filePath: string // Absolute path
  relativePath: string // Relative to repo root
  name: string // Symbol name
  kind: SymbolKind // function | class | interface | type | variable | constant
  startLine: number
  endLine: number
  signature: string // Extracted signature
  exported: boolean // Whether it's exported
}
```

**APIRoute (types/symbols.ts)**
```typescript
{
  repository: string
  method: string          // GET, POST, PUT, DELETE, PATCH
  path: string            // Route path (e.g., /users/:id)
  handler: string         // Handler function name
  framework: string       // express | nestjs | fastify | laravel
  parameters: {
    path: string[]        // Path params (e.g., ['id'])
    query: string[]       // Query params
  }
}
```

## Code Patterns & Conventions

### Module System
- Uses ES modules (`"type": "module"` in package.json)
- All imports must include `.js` extensions (even for .ts files)
- TypeScript config: `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`

### Testing
- Uses Vitest for testing
- Test files: `*.spec.ts` or `*.test.ts` alongside source files
- Tests are excluded from TypeScript compilation
- Coverage reports generated to `coverage/` directory

### Logging
- Centralized logger in `src/utils/logger.ts`
- Levels: debug, info, warn, error
- Set via `MCP_LOG_LEVEL` environment variable
- Use structured logging: `logger.info('message', { context: 'data' })`

### Error Handling
- Search engines catch and log errors, returning empty results instead of throwing
- Repository operations throw errors for invalid inputs (handled by MCP SDK)
- Timeout enforcement for long-running operations (ripgrep, AST parsing)

### Path Handling
- All repository paths are normalized and validated
- Security: symlink detection prevents directory traversal attacks
- Relative paths are calculated relative to repository root
- Path utilities in `src/utils/path-utils.ts`

### AST Pattern Syntax
ast-grep patterns use `$` metavariables:
- `$NAME` - captures a single node (e.g., function name)
- `$$$` - captures multiple nodes (e.g., function body)
- Example: `function $NAME($$$) { $$$ }` matches function declarations

## Important Implementation Details

### Symbol Export Detection
The SymbolSearchEngine uses a multi-layered approach to detect exports:
1. Check AST ancestry for `export_statement` nodes (handles `export function foo()`)
2. Regex check for named exports: `export { foo }`
3. Regex check for default exports: `export default foo`
4. Fallback: check if line starts with `export`

This is necessary because ast-grep's tree structure doesn't always capture all export patterns reliably.

### Ripgrep Integration
- Uses `@vscode/ripgrep` package for cross-platform ripgrep binary
- Spawns ripgrep as child process with `--json` output
- Implements timeout with SIGTERM followed by SIGKILL fallback
- Limits max file size (10MB) and matches per file (100) to prevent overwhelming results

### Repository Scanning
When a repository is registered:
1. Path validation and normalization
2. Git info extraction (if it's a git repo)
3. File scanning to count files by language
4. Metadata persisted to `~/.config/repo-lens-mcp/config.json`

### Performance Optimizations
- AST parsing is done once per file, then all patterns are matched against the same tree
- Results are deduplicated by symbol name + line number
- LRU cache with TTL reduces repeated searches
- Parallel repository searching for text search

### Security Boundaries
- All file paths are validated before access
- Symlinks are resolved and checked against repository boundaries
- No path traversal allowed outside registered repositories
- Max file size limits prevent reading huge files

## Language Expansion Strategy

Currently, only TypeScript/JavaScript are fully supported for symbol search. Adding new languages requires:
1. Add language to `src/constants.ts` (LANGUAGE_EXTENSIONS)
2. Add ast-grep language mapping in `src/parsers/language-registry.ts`
3. Create pattern file in `src/parsers/patterns/` (e.g., `python.ts`)
4. Define ast-grep patterns for each symbol kind

Refer to `docs/LANGUAGE_EXPANSION.md` and `ROADMAP.md` for planned language support.

## MCP Integration

This is an MCP server, not a standalone CLI tool. It's designed to be used by MCP clients (like Claude Desktop):
- Communicates over stdio using the MCP protocol
- Exposes tools (not REST endpoints)
- Tools are called by the LLM client, not directly by users
- Configuration happens via JSON config in Claude Desktop settings

## Notes for AI Assistants

- When adding new search capabilities, follow the pattern: Engine → Tool → Registration in index.ts
- AST patterns are language-specific; test thoroughly before committing
- All repository operations must respect the RepositoryManager's identifier resolution
- Cache invalidation happens automatically via TTL; manual invalidation is not implemented
- The server is stateful (maintains repository registry) but operations are persisted immediately
