# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-01-29

### Changed
- **BREAKING**: Refocused on multi-repository AST-based search
- Repository registration is now instant (< 1 second) - no metadata scanning
- Simplified configuration to 2 environment variables only
- Repository data structure: replaced `languages`, `fileCount`, `lastScanned` with `registeredAt`
- Converted all array parameters to comma-separated strings for better MCP client compatibility

### Removed
- **BREAKING**: `search_text` tool - use Claude Code's built-in `Grep` tool
- **BREAKING**: `get_file` tool - use Claude Code's built-in `Read` tool
- **BREAKING**: `get_file_info` tool - use Claude Code's built-in `Read` tool
- **BREAKING**: `list_dir` tool - use Claude Code's built-in `Glob` tool
- **BREAKING**: `find_enums` tool - use `find_types` or `Grep`
- **BREAKING**: `find_variables` tool - use Claude Code's `Grep` tool
- **BREAKING**: `find_constants` tool - use Claude Code's `Grep` tool
- Caching system (LRU cache) - minimal benefit in typical usage
- `@vscode/ripgrep` dependency (~50MB package size reduction)
- `lru-cache` dependency
- Configuration options: `MCP_CACHE_ENABLED`, `MCP_CACHE_TTL`, `MCP_CACHE_MAX_ENTRIES`, `MCP_SEARCH_TIMEOUT_MS`, `MCP_MAX_SEARCH_RESULTS`, `MCP_MAX_FILE_SIZE`

### Fixed
- Resolved parameter type issues causing input loops in MCP clients
- Added debug logging to all tool entry points for better tracing

### Migration
See [docs/MIGRATION.md](docs/MIGRATION.md) for detailed migration instructions.

## [0.1.2] - 2026-01-27

### Stabilized
- **Repository Tools**: Renamed `list_repositories` to `list_registered_repositories` to force platform re-indexing and changed `tags` parameter to a comma-separated string to prevent input loops in MCP clients.
- **Search Tools**: Converted all array parameters (e.g., `repos`, `tags`) to comma-separated strings across `search_text`, `find_api_routes`, and all symbol search tools.
- **Observability**: Added debug logging to all tool entry points for better tracing.
- **Parsing**: Introduced proper string splitting utility to handle various input formats robustly.

## [0.1.1-alpha] - 2026-01-26

### Fixed
- Resolved npm publication conflict by bumping version.
- Optimized package size by excluding test/spec files from the npm bundle.
- Improved CI/CD reliability with manual trigger and fixed release events.

## [0.1.0-alpha] - 2026-01-26 (Unpublished)

### Added
- **Initial Release** of repo-lens-mcp
- **Repository Management**:
  - `register_repository` - Add a repo to the search index
  - `list_repositories` - View active repositories
  - `unregister_repository` - Remove a repo from the index
- **AST Symbol Search** (powered by ast-grep):
  - `find_functions` - Locate functions, arrow functions, methods
  - `find_classes` - Find class definitions
  - `find_api_routes` - Map Express/NestJS/Fastify API endpoints
  - `find_types` - Search TypeScript interfaces and types
  - `find_variables` - Locate variable declarations
  - `find_constants` - Find constant declarations
- **Text Search**:
  - `search_text` - High-performance text search via ripgrep
- **File Operations**:
  - `get_file` - Read file content with line-range support
  - `get_file_info` - Get file metadata (size, language, modified date)
  - `list_dir` - Browse repository structure
- **Security Features**:
  - Sandboxed file access with symlink protection
  - Path validation to prevent directory traversal attacks
- **Performance**:
  - LRU caching for search results
  - Async mutex for concurrent operations
- **CI/CD**:
  - GitHub Actions workflow for canary releases (`@next` tag)
  - Automated testing and linting

### Security
- All file operations are sandboxed within registered repositories
- Symlink traversal protection enabled
- Input validation on all user-provided paths

[0.1.0-alpha]: https://github.com/YohannHommet/repo-lens-mcp/releases/tag/v0.1.0-alpha
