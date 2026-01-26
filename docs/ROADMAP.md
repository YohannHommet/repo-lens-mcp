# 🗺️ Product Roadmap

> **Mission:** To build the definitive "Context Engine" for AI Agents, bridging the gap between flat text search and deep structural code understanding.

This document outlines the strategic direction for `repo-lens-mcp`. Our goal is to move beyond simple "grep" and provide Agents with "X-Ray Vision" into codebases using AST analysis, semantic understanding, and graph relationships.

---

## 🧭 Strategic Pillars

1.  **Structural Intelligence** (AST > Regex)
    *   We prioritize understanding code *structure* (functions, classes, scopes) over raw text matching.
2.  **Hybrid Retrieval**
    *   Combining exact match (ripgrep), structural match (ast-grep), and semantic match (embeddings) for perfect recall.
3.  **Agent-First Design**
    *   Outputs are optimized for LLM consumption (Markdown, syntax highlighting, token-efficient summaries).
4.  **Local & Private**
    *   Zero external cloud dependencies. Your code stays on your machine.

---

## 🚀 Milestones

### ✅ Phase 1: Foundation (v0.1.0 - Current)
*Focus: Core stability, multi-repo support, and basic AST search.*
- [x] **Multi-Repo Management**: Register/Unregister local repositories.
- [x] **Text Search**: Ripgrep integration for high-performance string matching.
- [x] **Symbol Search**: `find_functions`, `find_classes`, `find_types` via `ast-grep`.
- [x] **API Discovery**: Auto-detection of Express/NestJS/Fastify routes.
- [x] **Agent UX**: Markdown-formatted responses with language detection.

---

### 🏗️ Phase 2: The "Graph" Update (Q1 2026)
*Focus: Understanding relationships between files and symbols.*

#### **1. Cross-File References (`find_references`)**
Instead of just finding *definitions*, find *usages*.
- **Feature:** `find_references(symbol_name)`
- **Value:** Allows agents to see everywhere a function is called or a class is instantiated.
- **Tech:** AST-based usage scanning across registered repos.

#### **2. Smart Context Summaries (`get_file_outline`)**
Agents often don't need the whole file—they just need the shape.
- **Feature:** `get_file_outline(path)` returns just the signatures of functions/classes (hiding bodies).
- **Value:** Saves 80% of tokens when exploring large files.

#### **3. Live Indexing (Watch Mode)**
- **Feature:** File watcher to auto-update the index when you save files in your IDE.
- **Value:** "Always-fresh" results without needing to restart the server.

---

### 🧠 Phase 3: The "Brain" Update (Q2 2026)
*Focus: Semantic understanding and natural language search.*

#### **1. Local Semantic Search**
- **Feature:** `search_semantic(query: "how is auth handled?")`
- **Tech:** Integration with local embedding models (e.g., `all-MiniLM-L6-v2` via ONNX or Ollama).
- **Value:** Finds code based on *intent*, not just keywords.

#### **2. Hybrid Ranking**
- **Feature:** Unified search results ranking.
- **Value:** Combines exact matches (ripgrep) with semantic matches (vectors) to surface the most relevant code first.

#### **3. Dependency X-Ray**
- **Feature:** `analyze_dependencies(path)`
- **Value:** visualization of imports/exports to understand architectural coupling.

---

### 🌐 Phase 2.5: Python Support (Q1 2026)
*Focus: First major language expansion beyond JS/TS/PHP.*

#### **1. Python AST Symbol Search**
- **Feature:** `find_functions`, `find_classes`, `find_types` for Python files.
- **Value:** Opens the server to the massive Python ecosystem (AI/ML, web, scripts).
- **Tech:** Extend `parsers/language-registry.ts` and add Python patterns in `parsers/patterns/python.ts`.

#### **2. Python API Route Detection**
- **Feature:** Auto-detect Flask and Django routes.
- **Value:** Enables agents to navigate Python web apps.
- **Tech:** Add Flask/Django pattern matchers in `api-route-search.ts`.

---

### 🦀 Phase 3.5: Systems Languages (Q2 2026)
*Focus: Go and Rust support for cloud-native and systems code.*

#### **1. Go & Rust AST Symbol Search**
- **Feature:** Full symbol search for `.go` and `.rs` files.
- **Value:** Supports the growing systems programming community.
- **Tech:** Add language mappings and AST patterns for Go and Rust.

#### **2. Go & Rust API Route Detection**
- **Feature:** Detect Gin/Echo (Go) and Actix-web/Axum (Rust) routes.
- **Value:** Makes the server useful for modern microservice stacks.

---

### 🏢 Phase 4.5: Enterprise Languages (Q3 2026)
*Focus: Java and C# for enterprise environments.*

#### **1. Java & C# AST Symbol Search**
- **Feature:** Symbol search for `.java` and `.cs` files.
- **Value:** Opens the server to enterprise codebases.
- **Tech:** Add language mappings and patterns for Java/C#.

#### **2. Enterprise API Route Detection**
- **Feature:** Detect Spring Boot (Java) and ASP.NET Core (C#) routes.
- **Value:** Enables agents to navigate large enterprise apps.

---

### 🤖 Phase 4: The "Agent" Update (Future)
*Focus: Active participation and deep autonomy.*

- [ ] **Active Refactoring**: Allow the server to apply patches or refactors safely.
- [ ] **Remote Repositories**: Index GitHub/GitLab repos without cloning them manually.
- [ ] **LSP Integration**: Hook directly into Language Server Protocols for perfect type resolution.
- [ ] **Plugin System**: Allow community extensions for new languages/frameworks.

---

## 💡 Feature Requests & Feedback
We build for **You**. If you have ideas or need specific features for your Agent workflows, please [open an issue](https://github.com/YohannHommet/mcp-repo-search-server/issues).
