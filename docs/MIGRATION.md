# Migration Guide: v0.1.x to v0.2.0

## Overview

Version 0.2.0 focuses repo-lens-mcp on its core strength: **multi-repository AST-based symbol search and API route discovery**. Features that duplicate Claude Code's built-in capabilities have been removed.

## Breaking Changes

### Removed Tools

The following tools have been removed:

| Removed Tool | Alternative |
|:---|:---|
| `unregister_repository` | Use `repositories({ identifier: '...', remove: true })` |
| `list_repositories` | Use `repositories()` or `repositories({ tags: [...] })` |
| `get_repository_info` | Use `repositories({ identifier: '...' })` |
| `refresh_repository` | Use `register_repository({ path: '...', force: true })` |
| `search_text` | Use Claude Code's built-in `Grep` tool |
| `get_file` | Use Claude Code's built-in `Read` tool |
| `get_file_info` | Use Claude Code's built-in `Read` tool |
| `list_dir` | Use Claude Code's built-in `Glob` tool |
| `find_enums` | Use `find_types` or Claude Code's `Grep` |
| `find_variables` | Use Claude Code's `Grep` tool |
| `find_constants` | Use Claude Code's `Grep` tool |

### Removed Configuration Options

The following environment variables are no longer supported:

| Removed Variable | Notes |
|:---|:---|
| `MCP_CACHE_ENABLED` | Caching has been removed |
| `MCP_CACHE_TTL` | Caching has been removed |
| `MCP_CACHE_MAX_ENTRIES` | Caching has been removed |
| `MCP_SEARCH_TIMEOUT_MS` | Timeout configuration removed |
| `MCP_MAX_SEARCH_RESULTS` | Use tool's `maxResults` parameter |
| `MCP_MAX_FILE_SIZE` | File operations removed |

### Configuration File Changes

The repository configuration file (`~/.config/mcp-repo-search/repositories.json`) has been updated:

**Before (v0.1.x):**
```json
{
  "version": 1,
  "repositories": [{
    "id": "...",
    "path": "/path/to/repo",
    "languages": ["typescript", "javascript"],
    "fileCount": 1234,
    "lastScanned": "2026-01-01T00:00:00.000Z"
  }]
}
```

**After (v0.2.0):**
```json
{
  "version": 1,
  "repositories": [{
    "id": "...",
    "path": "/path/to/repo",
    "registeredAt": "2026-01-01T00:00:00.000Z"
  }]
}
```

**Action Required:** Delete your existing configuration file or manually update the format. The new version will create a fresh file on first run.

```bash
rm ~/.config/mcp-repo-search/repositories.json
```

Then re-register your repositories.

## Remaining Tools (6 total)

### Repository Management (2 tools)

- `register_repository` - Add or update a git repository (`force: true` to update)
- `repositories` - List, view, or remove repositories

**`repositories` usage:**
```
repositories()                              → List all repos (markdown)
repositories({ tags: ['frontend'] })        → List filtered repos
repositories({ identifier: 'my-api' })      → Get one repo (JSON)
repositories({ identifier: 'x', remove: true }) → Remove repo
```

### Symbol Search (3 tools)

- `find_functions` - Find function/method definitions
- `find_classes` - Find class definitions
- `find_types` - Find TypeScript interfaces and type aliases

### API Route Discovery (1 tool)

- `find_api_routes` - Map API endpoints across Express, NestJS, Fastify, Laravel

## Benefits of v0.2.0

### Faster Registration

Repository registration is now instant (< 1 second) because:
- No file scanning occurs during registration
- No language detection
- No file counting
- Only git validation and info extraction

### Smaller Package

- Removed `@vscode/ripgrep` dependency (~50MB binary)
- Removed `lru-cache` dependency
- Faster installation

### Simpler Configuration

Only 2 environment variables:
- `MCP_LOG_LEVEL` (default: `info`)
- `MCP_REPO_SEARCH_CONFIG_DIR` (default: `~/.config/mcp-repo-search`)

### Clearer Purpose

Repo Lens now has a clear, focused purpose: cross-repository AST-based search. Use Claude Code's built-in tools for everything else.

## FAQ

### Why was text search removed?

Claude Code's built-in `Grep` tool is more efficient for single-repo text search. Repo Lens's unique value is cross-repository AST-based search, not duplicating existing capabilities.

### Why were file operations removed?

Claude Code's `Read` and `Glob` tools handle file operations within the current repository. Repo Lens focuses on cross-repository symbol search.

### Why was caching removed?

In a typical Claude Code session, you rarely repeat the exact same search query. The overhead of cache management wasn't worth the minimal benefit.

### Can I still use v0.1.x?

Yes, but it won't receive updates. We recommend migrating to v0.2.0 for the focused, faster experience.

## Need Help?

If you encounter issues during migration, please [open an issue](https://github.com/YohannHommet/repo-lens-mcp/issues).
