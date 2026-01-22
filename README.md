# MCP Repo Search Server

An MCP (Model Context Protocol) server for Claude Code that enables parsing and searching across multiple local git repositories. Perfect for cross-project context (e.g., frontend app accessing backend API definitions).

## Features

- **Repository Management**: Register, unregister, and list local git repositories
- **Text Search**: Fast ripgrep-powered search across all repositories
- **Symbol Search**: AST-based search for functions, classes, types, and interfaces
- **File Operations**: Get file contents, list files, search by filename
- **Cross-Project Context**: Search across multiple repos simultaneously

## Installation

```bash
npm install
npm run build
```

## Configuration

Add to your `.mcp.json` in Claude Code:

```json
{
  "mcpServers": {
    "repo-search": {
      "command": "node",
      "args": ["/home/$USER/mcp-repo-search-server/dist/index.js"],
      "env": {
        "MCP_MAX_SEARCH_RESULTS": "500",
        "MCP_LOG_LEVEL": "info"
      }
    }
  }
}
```

## Available Tools

### Repository Management

| Tool | Description |
|------|-------------|
| `register_repository` | Register a local git repo with optional alias and tags |
| `unregister_repository` | Remove a repository from the search pool |
| `list_repositories` | List all registered repositories |
| `get_repository_info` | Get detailed repository metadata |
| `refresh_repository` | Re-scan a repository to update metadata |

### Text Search

| Tool | Description |
|------|-------------|
| `search_text` | Search for text pattern across repositories (supports regex, glob filtering) |

### Symbol Search (AST-based)

| Tool | Description |
|------|-------------|
| `find_functions` | Find function/method definitions |
| `find_classes` | Find class definitions |
| `find_types` | Find type/interface definitions |

### File Operations

| Tool | Description |
|------|-------------|
| `get_file` | Retrieve file contents (with optional line range) |
| `list_files` | List files in a repository path |
| `search_files` | Find files by name pattern |
| `get_file_info` | Get file metadata |
| `get_project_structure` | Get repository structure overview |

## Usage Examples

### Register repositories

```text
register_repository path="/home/user/projects/backend" alias="backend" tags=["api", "typescript"]
register_repository path="/home/user/projects/frontend" alias="frontend" tags=["react", "typescript"]
```

### Search across projects

```text
search_text pattern="fetchUsers" repos=["frontend", "backend"]
find_functions name="handle*" repos=["backend"] exportedOnly=true
find_types name="User" repos=["backend"]
```

### Get file contents

```text
get_file filePath="/home/user/projects/backend/src/routes/users.ts"
list_files repoIdentifier="backend" glob="*.ts"
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_REPO_SEARCH_CONFIG_DIR` | `~/.config/mcp-repo-search` | Configuration directory |
| `MCP_MAX_SEARCH_RESULTS` | `500` | Maximum search results |
| `MCP_LOG_LEVEL` | `info` | Log level (debug, info, warn, error) |

## License

MIT
