<div align="center">

# Repo Lens MCP Server

**Cross-repository code intelligence for developers.**

[![NPM Version](https://img.shields.io/npm/v/repo-lens-mcp?style=for-the-badge&logo=npm&color=CB3837)](https://www.npmjs.com/package/repo-lens-mcp)
[![Build Status](https://img.shields.io/github/actions/workflow/status/YohannHommet/repo-lens-mcp/publish.yml?style=for-the-badge&logo=github-actions&logoColor=white)](https://github.com/YohannHommet/repo-lens-mcp/actions)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-red?style=for-the-badge&logo=opensourceinitiative&logoColor=white)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MCP Ready](https://img.shields.io/badge/MCP-Ready-green?style=for-the-badge&logo=modelcontextprotocol&logoColor=white)](https://modelcontextprotocol.io)

*Search functions, classes, and API routes across all your local JS/TS and PHP repositories without switching context.*

</div>

---

## Why Use This?

**The problem:** You're working in your frontend repo and need to find a backend API endpoint. Or you're debugging and need to find where a function is defined across your monorepo. With Claude Code, you can search the current repository, but what about your other local projects?

**The solution:** Repo Lens lets you register multiple local repositories and search across all of them simultaneously using AST-based structural search. Find the exact function signature, class definition, or API route you need without leaving your current context.

### Use Cases

- **Frontend + Backend development:** Search backend API routes while working in your frontend repo
- **PHP + JS/TS projects:** Find PHP classes, traits, and interfaces alongside TypeScript types
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
pnpm install
pnpm build
pnpm dev
```

---

## Capabilities

### Repository Management (2 tools)

Manage which repositories are available for cross-repo search:

| Tool | Description |
|:---|:---|
| `repolens_register_repository` | Add or update a git repository (`force: true` to update existing) |
| `repolens_repositories` | List, view, or remove repositories |

**`repolens_repositories` usage patterns:**
- `repolens_repositories()` → List all repos
- `repolens_repositories({ identifier: 'my-api' })` → Get details of one repo
- `repolens_repositories({ identifier: 'my-api', remove: true })` → Remove that repo
- `repolens_repositories({ tags: ['frontend'] })` → List repos filtered by tags

### Symbol Search (3 tools)

AST-based structural search powered by ast-grep. Supports **JavaScript/TypeScript** and **PHP** (classes, traits, interfaces, enums, functions, methods, constants):

| Tool | Description |
|:---|:---|
| `repolens_find_functions` | Find function/method definitions in JS/TS and PHP (supports wildcards like `handle*`) |
| `repolens_find_classes` | Find class definitions (also finds PHP traits) |
| `repolens_find_types` | Find interfaces and type aliases (PHP: interfaces only) |

### API Route Discovery (1 tool)

| Tool | Description |
|:---|:---|
| `repolens_find_api_routes` | Map API endpoints across Express, NestJS, Fastify, Laravel |

---

## Usage Examples

### 1. Register Your Projects

> "Register the backend at /path/to/backend-api"

```
repolens_register_repository(path: "/path/to/backend-api", alias: "backend")
```

### 2. Find an API Endpoint

> "Find the Express route that handles POST requests to /login"

```
repolens_find_api_routes(framework: "express", method: "POST", pathPattern: "/login")
```

### 3. Search Functions Across Repos

> "Find all functions starting with 'handle' across all my registered repos"

```
repolens_find_functions(name: "handle*")
```

### 4. Find a Specific Class

> "Where is the UserService class defined?"

```
repolens_find_classes(name: "UserService")
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
