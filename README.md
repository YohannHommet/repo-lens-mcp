<div align="center">

# Repo Lens MCP Server

**Your codebase, illuminated.**

[![NPM Version](https://img.shields.io/npm/v/repo-lens-mcp?style=for-the-badge&logo=npm&color=CB3837)](https://www.npmjs.com/package/repo-lens-mcp)
[![Build Status](https://img.shields.io/github/actions/workflow/status/YohannHommet/repo-lens-mcp/publish.yml?style=for-the-badge&logo=github-actions&logoColor=white)](https://github.com/YohannHommet/repo-lens-mcp/actions)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-red?style=for-the-badge&logo=opensourceinitiative&logoColor=white)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MCP Ready](https://img.shields.io/badge/MCP-Ready-green?style=for-the-badge&logo=modelcontextprotocol&logoColor=white)](https://modelcontextprotocol.io)

*Stop letting your LLM grep blindly. Upgrade to structural code intelligence!*

</div>

---

## Overview

This is a **Model Context Protocol (MCP)** server tailored for serious development workflows. It doesn't just "read files"; it understands project structure, maps entire repositories, and performs AST-based searches to find exactly what you need—instantly.

---

## Quickstart

```bash
npx repo-lens-mcp
```

---

## Key Features

Most code search tools are dumb using simple regex. This server uses **[ast-grep](https://ast-grep.github.io/)** (written in Rust) to parse your code into an Abstract Syntax Tree.

*   **Intelligence:** Distinguish between `class User` and `const User`. Find exported functions, not just the word "function".
*   **Speed:** Powered by `ripgrep` for text and `ast-grep` for symbols. It screams.
*   **Context:** Map API routes (Express, NestJS, output) to find entry points in seconds.
*   **Security:** Sandboxed file access with symlink protection. No more `../../etc/passwd` accidents.

---

## Roadmap

We have big plans for the future of structural code intelligence.

- **Phase 1 (Current):** Stability, Multi-repo, Basic AST.
- **Phase 2 (Q1 2026):** Cross-file references, Smart Context Summaries, Live Indexing.
- **Phase 3 (Q2 2026):** **Semantic Search (Local Embeddings)**, Hybrid Ranking.
- **Phase 2.5 (Q1 2026):** Python support (symbol search + Flask/Django routes).
- **Phase 3.5 (Q2 2026):** Go & Rust support.
- **Phase 4.5 (Q3 2026):** Java & C# support.

[👉 Check out the full ROADMAP.md](ROADMAP.md) • [🌐 Language Expansion Plan](docs/LANGUAGE_EXPANSION.md)

---

## Installation

### Option 1: Claude Desktop / VS Code (Recommended)

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

*Restart Claude, and you're ready to go.*

### Option 2: Local Development

If you want to contribute or run from source:

```bash
git clone https://github.com/YohannHommet/repo-lens-mcp.git
cd repo-lens-mcp
npm install
npm run build
# Test it
npx tsx scripts/test-server.ts
```

---

## Capabilities

### 1. Repository Management
Don't scan your whole hard drive. Register specific projects to keep context clean.
- `register_repository`: Add a repo to the search index (requires absolute path).
- `list_repositories`: See what's currently active.
- `unregister_repository`: Remove a repo from the index.

### 2. AST Symbol Search (The Intelligence)
Stop getting noise in your search results.
- `find_functions`: Find logic (`function`, `ArrowFunction`, methods).
- `find_classes`: Locate entities.
- `find_api_routes`: **Killer Feature.** Instantly maps all API endpoints in Express/NestJS/Fastify apps.
- `find_types`: TypeScript interfaces and types.
- `find_variables`: Locate variable declarations.
- `find_constants`: Locate constant declarations.

### 3. High-Performance Text Search
For when you just need to find a string, fast.
- `search_text`: Validated, secure wrapper around `ripgrep`.

### 4. File Operations
- `get_file`: Read content with line-range support.
- `get_file_info`: Metadata only (size, language, last modified).
- `list_dir`: Browse repository structure.

---

## Usage Examples

Once installed, your LLM can use the following commands:

### 1. Indexing a Project
> "Register the repository at /path/to/my-project"
Calls `register_repository(path: "/path/to/my-project")`

### 2. Finding an API Endpoint
> "Find the Express route that handles POST requests to /login"
Calls `find_api_routes(framework: "express", method: "POST", pathPattern: "/login")`

### 3. Understanding a Class
> "Find the definition of the User class and show me its methods"
Calls `find_classes(name: "User")` followed by `get_file` for the relevant lines.

---

## Configuration

You can tweak the server by passing environment variables in your JSON config:

| Variable | Default | Description |
|:---|:---|:---|
| `MCP_CACHE_ENABLED` | `true` | Keep it `true` unless you like slow searches. |
| `MCP_LOG_LEVEL` | `info` | Set to `debug` if things go south. |
| `MCP_SEARCH_TIMEOUT_MS` | `30000` | Max time before killing a search. |

Example:
```json
{
  "env": {
    "MCP_LOG_LEVEL": "error",
    "MCP_CACHE_ENABLED": "true"
  }
}
```

---

## License

**AGPL-3.0**

This software is free to use. However, if you modify it and distribute it (or run it as a network service), you **must** share your source code under the same license.
**Your code is yours; this server's code must remain open.**

---

<p align="center">
  Built with ❤️ by Yohann Hommet
</p>
