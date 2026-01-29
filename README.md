<div align="center">

# Repo Lens MCP Server

**Cross-repository code intelligence for developers.**

[![NPM Version](https://img.shields.io/npm/v/repo-lens-mcp?style=for-the-badge&logo=npm&color=CB3837)](https://www.npmjs.com/package/repo-lens-mcp)
[![Build Status](https://img.shields.io/github/actions/workflow/status/YohannHommet/repo-lens-mcp/publish.yml?style=for-the-badge&logo=github-actions&logoColor=white)](https://github.com/YohannHommet/repo-lens-mcp/actions)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-red?style=for-the-badge&logo=opensourceinitiative&logoColor=white)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MCP Ready](https://img.shields.io/badge/MCP-Ready-green?style=for-the-badge&logo=modelcontextprotocol&logoColor=white)](https://modelcontextprotocol.io)

*Search functions, classes, and API routes across all your local repositories without switching context.*

</div>

---

## Why Use This?

**The problem:** You're working in your frontend repo and need to find a backend API endpoint. Or you're debugging and need to find where a function is defined across your monorepo. With Claude Code, you can search the current repository, but what about your other local projects?

**The solution:** Repo Lens lets you register multiple local repositories and search across all of them simultaneously using AST-based structural search. Find the exact function signature, class definition, or API route you need without leaving your current context.

### Use Cases

- **Frontend + Backend development:** Search backend API routes while working in your frontend repo
- **Microservices architecture:** Find function definitions across multiple services
- **Monorepo navigation:** Search across packages without switching directories
- **Code exploration:** Understand how different projects in your ecosystem connect

---

## Quickstart

```bash
npx repo-lens-mcp
```

---

## Key Features

### AST-Based Intelligence

Unlike grep-style text search, Repo Lens uses **[ast-grep](https://ast-grep.github.io/)** (written in Rust) to parse code into Abstract Syntax Trees:

- **Structural accuracy:** Distinguish between `class User` and `const User`
- **Export awareness:** Find only exported functions, or include private ones
- **Signature extraction:** Get full function signatures, not just names

### Multi-Repository Search

Register any number of local git repositories and search them all at once:

- Instant registration (< 1 second per repo)
- Filter by repository, tags, or search all
- Results include repository context

### API Route Discovery

Map all API endpoints across Express, NestJS, Fastify, and Laravel projects. Find that `/users/:id` endpoint in seconds.

---

## Roadmap

- **Phase 1 (Current):** Stability, Multi-repo, Basic AST
- **Phase 2 (Q1 2026):** Cross-file references, Smart Context Summaries
- **Phase 2.5 (Q1 2026):** Python support (symbol search + Flask/Django routes)
- **Phase 3 (Q2 2026):** Semantic Search (Local Embeddings)
- **Phase 3.5 (Q2 2026):** Go & Rust support
- **Phase 4.5 (Q3 2026):** Java & C# support

[Check the full ROADMAP.md](ROADMAP.md) | [Language Expansion Plan](docs/LANGUAGE_EXPANSION.md)

---

## Installation

### Claude Desktop / VS Code (Recommended)

Add this to your `claude_desktop_config.json` (or VS Code MCP settings):

```json
{
  "mcpServers": {
    "repo-lens": {
      "command": "npx",
      "args": ["-y", "repo-lens-mcp"]
    }
  }
}
```

Restart Claude, and you're ready to go.

### Local Development

```bash
git clone https://github.com/YohannHommet/repo-lens-mcp.git
cd repo-lens-mcp
npm install
npm run build
npm run dev
```

---

## Capabilities

### Repository Management (5 tools)

Manage which repositories are available for cross-repo search:

| Tool | Description |
|:---|:---|
| `register_repository` | Add a git repository to the search pool |
| `unregister_repository` | Remove a repository |
| `list_repositories` | View all registered repositories |
| `get_repository_info` | Get detailed info about a repository |
| `refresh_repository` | Update git information for a repository |

### Symbol Search (3 tools)

AST-based structural search powered by ast-grep:

| Tool | Description |
|:---|:---|
| `find_functions` | Find function/method definitions (supports wildcards like `handle*`) |
| `find_classes` | Find class definitions |
| `find_types` | Find TypeScript interfaces and type aliases |

### API Route Discovery (1 tool)

| Tool | Description |
|:---|:---|
| `find_api_routes` | Map API endpoints across Express, NestJS, Fastify, Laravel |

---

## Usage Examples

### 1. Register Your Projects

> "Register the backend at /path/to/backend-api"

```
register_repository(path: "/path/to/backend-api", alias: "backend")
```

### 2. Find an API Endpoint

> "Find the Express route that handles POST requests to /login"

```
find_api_routes(framework: "express", method: "POST", pathPattern: "/login")
```

### 3. Search Functions Across Repos

> "Find all functions starting with 'handle' across all my registered repos"

```
find_functions(name: "handle*")
```

### 4. Find a Specific Class

> "Where is the UserService class defined?"

```
find_classes(name: "UserService")
```

---

## Configuration

Minimal configuration via environment variables:

| Variable | Default | Description |
|:---|:---|:---|
| `MCP_LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `MCP_REPO_SEARCH_CONFIG_DIR` | `~/.config/mcp-repo-search` | Config directory for repository data |

Example:
```json
{
  "env": {
    "MCP_LOG_LEVEL": "debug"
  }
}
```

---

## What About Text Search / File Operations?

Repo Lens focuses on **multi-repository AST-based search**. For text search and file operations within your current repository, use Claude Code's built-in tools (Grep, Read, Glob) which are optimized for single-repo use.

This separation keeps Repo Lens fast and focused on what it does best: cross-repository structural code intelligence.

---

## License

**AGPL-3.0**

This software is free to use. If you modify and distribute it (or run it as a network service), you must share your source code under the same license.

---

<p align="center">
  Built with care by Yohann Hommet
</p>
