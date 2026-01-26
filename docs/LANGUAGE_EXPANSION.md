# 🌐 Language Expansion Plan

> **Goal:** Evolve from a JS/TS-centric tool to a multi-language powerhouse, enabling agents to understand codebases across the entire development landscape.

---

## 📊 Current State

| Language | Symbol Search (AST) | API Route Detection | Status |
|----------|---------------------|---------------------|--------|
| JavaScript/TypeScript | ✅ (ast-grep) | ✅ (Express/Fastify/NestJS) | ✅ Done |
| PHP | ✅ (ast-grep) | ✅ (Laravel) | ✅ Done |
| Python | ❌ (ripgrep only) | ❌ | 🚧 Planned |
| Go | ❌ (ripgrep only) | ❌ | 🚧 Planned |
| Rust | ❌ (ripgrep only) | ❌ | 🚧 Planned |
| Java | ❌ (ripgrep only) | ❌ | 🚧 Planned |
| C# | ❌ (ripgrep only) | ❌ | 🚧 Planned |

---

## 🚀 Implementation Guide

### Step 1: Add Language to Registry
Edit `src/parsers/language-registry.ts`:
```ts
const EXTENSION_TO_LANG: Record<string, Lang> = {
  // existing...
  '.py': Lang.Python,
  '.go': Lang.Go,
  '.rs': Lang.Rust,
  '.java': Lang.Java,
  '.cs': Lang.CSharp,
}
```

### Step 2: Add AST Patterns
Create `src/parsers/patterns/python.ts` (example):
```ts
import { PatternBuilder } from '@ast-grep/napi'

export const PYTHON_PATTERNS = {
  function: new PatternBuilder()
    .kind('function_definition')
    .inside('kind: function_definition')
    .build(),
  class: new PatternBuilder()
    .kind('class_definition')
    .build(),
}
```

### Step 3: Register Patterns
Update `src/parsers/patterns/index.ts` to import and map patterns.

### Step 4: API Route Detection (Optional)
Add framework-specific pattern matchers in `src/search/api-route-search.ts`.

---

## 🎯 Priority Queue

1. **Python** (Q1 2026) — Huge AI/ML community, Flask/Django are dominant.
2. **Go** (Q2 2026) — Cloud-native, Gin/Echo popular.
3. **Rust** (Q2 2026) — Growing systems language, Actix-web/Axum.
4. **Java** (Q3 2026) — Enterprise, Spring Boot.
5. **C#** (Q3 2026) — Enterprise, ASP.NET Core.

---

## 📦 Binary Size Impact

| Language | Estimated Size Increase |
|----------|------------------------|
| Python | ~2.5 MB |
| Go | ~2.0 MB |
| Rust | ~2.0 MB |
| Java | ~3.0 MB |
| C# | ~2.5 MB |

**Mitigation:** We'll ship a lean core (JS/TS/PHP) and allow users to opt-in to additional languages via config or separate packages.

---

## 🛠️ Development Tips

- Use `ast-grep playground` to test patterns before committing.
- Start with symbol search; API routes can come later.
- Add tests for each language in `tests/symbols/`.
- Keep patterns language-agnostic where possible (e.g., "function definition" concepts).

---

## 🤝 Community Contributions

Once the plugin system is live (Phase 4), we'll welcome community language extensions. For now, feel free to open an issue or PR to help prioritize the next language!
