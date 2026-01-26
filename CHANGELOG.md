# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0-alpha] - 2026-01-26

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
