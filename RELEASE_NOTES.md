# Release: v1.0.0 — Repo Lens MCP Server

### Summary
A Model Context Protocol (MCP) server that gives your LLM structural, high‑precision visibility into local codebases. Instead of blind text grep, Repo Lens parses projects into ASTs, maps repository structure and API entry points, and provides secure, high-performance search and file operations for developer workflows and LLM integrations.

### Highlights
- AST-powered symbol search using ast-grep (distinguishes e.g., class vs. const, exported functions vs. noise).
- Blazing-fast text search backed by ripgrep.
- Automatic API route mapping (Express, NestJS, Fastify) to quickly find endpoints and entry points.
- Secure, sandboxed file access with symlink protection.
- MCP-ready: plug into Claude Desktop, VS Code, or other MCP clients.
- Published as npm package mcp-repo-search-server.

### New features
- Repository management endpoints:
  - register_repository (index a repository by absolute path)
  - list_repositories
  - unregister_repository
- AST symbol search endpoints:
  - find_functions, find_classes, find_types, find_variables, find_constants
  - find_api_routes: maps API routes for Express/Nest/Fastify
- File and metadata operations:
  - get_file (with line-range support)
  - get_file_info (size, language, last modified)
  - list_dir
- High-performance text search:
  - search_text (secure wrapper around ripgrep)

### Improvements
- Uses ast-grep + ripgrep combination for precision + speed.
- Context-aware mapping of API routes to locate entry points quickly.
- Sandboxed file access to avoid path traversal and accidental system exposure.

### Configuration & defaults
- MCP_CACHE_ENABLED: true (recommended)
- MCP_LOG_LEVEL: info (set to debug for troubleshooting)
- MCP_SEARCH_TIMEOUT_MS: 30000 (milliseconds)
- Example env config is included in README for MCP clients.

### Usage snippets
- Install via MCP client (recommended):
  - Add to claude_desktop_config.json or VS Code MCP settings:
    {
      "mcpServers": {
        "repo-search": {
          "command": "npx",
          "args": ["-y", "mcp-repo-search-server"]
        }
      }
    }
- Local dev / from source:
  - git clone https://github.com/YohannHommet/mcp-repo-search-server.git
  - npm install && npm run build
  - Test: npx tsx scripts/test-server.ts

### Security & license
- Sandboxed file access with symlink protection to reduce attack surface.
- Licensed under AGPL-3.0 — if you modify and distribute, or run as a network service, you must share source under the same license.

### Migration / Breaking changes
- No breaking changes in this release.

### Notes for integrators
- Best used by MCP-aware LLM clients (Claude Desktop, VS Code MCP).
- Ideal for teams that want structural (AST) code intelligence rather than simple text search.

### Contributors
Built with ❤️ by Yohann Hommet