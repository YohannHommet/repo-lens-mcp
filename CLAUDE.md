# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**repo-lens-mcp** is a Model Context Protocol (MCP) server focused on **multi-repository AST-based symbol search and API route discovery**. It enables developers to search for functions, classes, types, and API routes across multiple local git repositories without leaving their current context.

### Core Value Proposition

The unique value is **cross-repository search**. While Claude Code's built-in tools (Grep, Read, Glob) work within the current repository, Repo Lens lets you search across all your registered local projects simultaneously.

### Use Cases

- Search backend API routes while working in a frontend repo
- Find function definitions across microservices
- Navigate monorepo packages without switching directories
- Explore how different projects in your ecosystem connect

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
npm run test:coverage      # Run tests with coverage report
```

### Code Quality
```bash
npm run lint               # Check code with ESLint
npm run lint:fix           # Auto-fix ESLint issues
npm run typecheck          # Run TypeScript type checking
npm run ci                 # Run full CI suite (test:coverage + typecheck + lint)
```

### Testing the Server
```bash
npx tsx scripts/test-server.ts    # Test the MCP server interactively
```

## Architecture

### Target Architecture

```
MCP Server (index.ts)
├── 3 Tool Categories
│   ├── Repository Tools (register, list, unregister, get_info, refresh)
│   ├── Symbol Tools (find_functions, find_classes, find_types)
│   └── API Tools (find_api_routes)
├── 2 Search Engines
│   ├── SymbolSearchEngine (AST-based)
│   └── APIRouteSearchEngine (framework detection)
└── Core Components
    ├── RepositoryManager (lightweight)
    ├── RepositoryScanner (git validation only)
    └── ConfigStore (repository persistence)
```

**Total: 9 tools**
- 5 repository management tools
- 3 symbol search tools
- 1 API route discovery tool

### Core Components

**Entry Point (src/index.ts)**
- Initializes the MCP server using `@modelcontextprotocol/sdk`
- Loads configuration (2 environment variables only)
- Creates and wires together search engines and managers
- Registers tool handlers (3 categories)
- Handles graceful shutdown on SIGINT/SIGTERM

**Repository Manager (src/core/repository-manager.ts)**
- Manages the registry of repositories that can be searched
- Persists repository metadata via ConfigStore
- Resolves repositories by ID, alias, or absolute path
- Instant registration (git validation only, no metadata scanning)

**Search Engines**

1. **SymbolSearchEngine (src/search/symbol-search.ts)**
   - AST-based structural code search for functions, classes, interfaces, types
   - Uses `@ast-grep/napi` (Rust-powered) to parse code into ASTs
   - Pattern matching defined in `src/parsers/patterns/`
   - Detects export status and extracts signatures

2. **APIRouteSearchEngine (src/search/api-route-search.ts)**
   - Specialized search for API endpoint definitions
   - Supports Express, Fastify, NestJS (decorators), Laravel (PHP facades)
   - Extracts HTTP method, path, handler name, and parameters

**Language Registry (src/parsers/language-registry.ts)**
- Maps file extensions to ast-grep language types
- Currently supports: TypeScript (.ts, .tsx), JavaScript (.js, .jsx, .mjs, .cjs)
- PHP support partial (for Laravel route detection only)

**AST Patterns (src/parsers/patterns/)**
- Defines ast-grep patterns for each symbol type
- Pattern syntax uses ast-grep's tree-sitter based matching

**Configuration (src/config/)**
- Only 2 environment variables:
  - `MCP_LOG_LEVEL`: debug, info, warn, error (default: info)
  - `MCP_REPO_SEARCH_CONFIG_DIR`: Config directory (default: ~/.config/mcp-repo-search)

### Key Types

**Repository (types/repository.ts)**
```typescript
{
  id: string              // UUID
  path: string            // Absolute path
  alias?: string          // Optional human-friendly name
  tags: string[]          // For filtering
  gitInfo: GitInfo        // Branch, remote, commit
  registeredAt: Date      // When repository was added
}
```

**SymbolResult (types/symbols.ts)**
```typescript
{
  repository: string      // Repo ID
  repositoryAlias?: string
  filePath: string        // Absolute path
  relativePath: string    // Relative to repo root
  name: string            // Symbol name
  kind: SymbolKind        // function | class | interface | type
  startLine: number
  endLine: number
  signature: string       // Extracted signature
  exported: boolean       // Whether it's exported
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

### MCP Tool Registration Pattern

All tools follow this pattern:
```typescript
server.tool(
  'tool_name',                    // snake_case naming
  'Clear description',            // Human-readable description
  {                               // Zod schema with documentation
    param: z.string().describe('What this does'),
  },
  async ({ param }) => {          // Type-safe handler
    try {
      // Implementation
      return { content: [{ type: 'text', text: result }] }
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true
      }
    }
  }
)
```

### Schema Validation Rules
- Every parameter must have `.describe()` documentation
- Use `.optional()` for optional parameters
- Arrays use `z.array(z.string())`
- Mention defaults in descriptions

### Error Handling Standard
- **NEVER throw** from tool handlers
- Always wrap in try-catch
- Return errors as responses with `isError: true`

### Response Format Standards
- Consistent: `{ content: [{ type: 'text', text: '...' }] }`
- Use Markdown for human-readable output
- Code blocks with language hints
- Tables for structured data

### Module System
- Uses ES modules (`"type": "module"` in package.json)
- All imports must include `.js` extensions (even for .ts files)
- TypeScript config: `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`

### Testing
- Uses Vitest for testing
- Test files: `*.spec.ts` alongside source files
- Tests excluded from TypeScript compilation

### Logging
- Centralized logger in `src/utils/logger.ts`
- All logs to stderr (preserves stdout for MCP protocol)
- Use structured logging: `logger.info('message', { context: 'data' })`

### Path Handling
- All repository paths are normalized and validated
- Security: symlink detection prevents directory traversal
- Path utilities in `src/utils/path-utils.ts`

### AST Pattern Syntax
ast-grep patterns use `$` metavariables:
- `$NAME` - captures a single node (e.g., function name)
- `$$$` - captures multiple nodes (e.g., function body)
- Example: `function $NAME($$$) { $$$ }` matches function declarations

## Important Implementation Details

### Symbol Export Detection
The SymbolSearchEngine uses a multi-layered approach:
1. Check AST ancestry for `export_statement` nodes
2. Regex check for named exports: `export { foo }`
3. Regex check for default exports: `export default foo`
4. Fallback: check if line starts with `export`

### Repository Registration
Registration is instant (< 1 second):
1. Path validation and normalization
2. Git validation (must be a git repository)
3. Git info extraction (branch, remote, commit)
4. Metadata persisted to config directory

No file scanning or language detection occurs during registration.

### Security Boundaries
- All file paths validated before access
- Symlinks resolved and checked against repository boundaries
- No path traversal allowed outside registered repositories

## Language Expansion Strategy

Currently, only TypeScript/JavaScript are fully supported for symbol search. Adding new languages requires:
1. Add language to `src/constants.ts` (LANGUAGE_EXTENSIONS)
2. Add ast-grep language mapping in `src/parsers/language-registry.ts`
3. Create pattern file in `src/parsers/patterns/` (e.g., `python.ts`)
4. Define ast-grep patterns for each symbol kind

Refer to `docs/LANGUAGE_EXPANSION.md` and `ROADMAP.md` for planned language support.

## Notes for AI Assistants

- When adding new search capabilities, follow the pattern: Engine -> Tool -> Registration in index.ts
- AST patterns are language-specific; test thoroughly before committing
- All repository operations must respect the RepositoryManager's identifier resolution
- The server is stateful (maintains repository registry) but operations are persisted immediately
- This server focuses on multi-repo AST search; text search and file operations should use Claude Code's built-in tools
