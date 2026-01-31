# MCP Server Directories & Lists

A short reference list of places to submit MCP servers for visibility.

## Directories
- **Model Context Protocol (official servers list)**
  - https://modelcontextprotocol.io (look for "Servers" / directory)
- **glama.ai MCP directory**
  - https://glama.ai
- **mcpservers.org**
  - https://mcpservers.org
- **mcpmarket.com**
  - https://mcpmarket.com
- **playbooks.com MCP**
  - https://playbooks.com

## Notes
- Keep submissions consistent: name, short description, long description, tags, and links.
- Prefer the npm + GitHub URLs as canonical references.

## Content

### Short description (≤140 chars)
```
Repo Lens MCP: Cross-repository AST-based symbol search and API route discovery for LLMs (ast-grep powered).
```

### Medium description (2–3 sentences)
```
Repo Lens MCP gives LLMs structural code intelligence across multiple local repositories. It uses ast-grep for AST-level symbol search (functions, classes, types) and discovers API routes across Express, Fastify, NestJS, and Laravel projects.
```

### Long description (paragraph)
```
Repo Lens MCP is a Model Context Protocol server focused on cross-repository code intelligence. Register multiple local git repositories and search them all simultaneously using AST-based structural search. Find functions, classes, and TypeScript types with export awareness and full signature extraction. Discover API endpoints across Express, NestJS, Fastify, and Laravel projects. Designed to complement Claude Code's built-in tools by providing the unique capability of searching across repositories.
```

### Key Features (bullets)
```
- Multi-repository AST symbol search (functions/classes/types)
- API route discovery (Express/Fastify/NestJS/Laravel)
- Instant registration (< 1 second per repo)
- Export-aware search with signature extraction
- 6 focused tools, minimal footprint
```

### Quickstart
```
npx repo-lens-mcp
```

### Links
```
GitHub: https://github.com/YohannHommet/repo-lens-mcp
npm: https://www.npmjs.com/package/repo-lens-mcp
```

### Tags / Categories
```
Tags: mcp, llm, code-search, ast, ast-grep, developer-tools, typescript, api-discovery, multi-repo
Category: Developer Tools / Code Intelligence / MCP Server
```

### Maintainer
```
Yohann Hommet
```

## LinkedIn Post Template

```text
Just released Repo Lens MCP v0.2.0 — a focused MCP server for cross-repository code intelligence.

What it does:
- AST-based symbol search across multiple repos (functions, classes, types)
- API route discovery (Express, NestJS, Fastify, Laravel)
- Instant repo registration (< 1 second)
- Designed to complement Claude Code's built-in tools

v0.2.0 highlights:
- Simplified from 15 to 6 focused tools
- 3-5x faster with parallel processing
- ~50MB smaller package

npm: https://www.npmjs.com/package/repo-lens-mcp
GitHub: https://github.com/YohannHommet/repo-lens-mcp

#MCP #LLM #CodeSearch #AST #DeveloperTools #TypeScript
```
