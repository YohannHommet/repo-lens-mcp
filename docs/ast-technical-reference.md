# AST Parsing Technical Reference

## Overview

The MCP server uses **ast-grep** (`@ast-grep/napi`) for structural code search. Unlike regex/text search, AST parsing understands code structure, enabling precise symbol extraction regardless of formatting.

```
Source Code → Lexer → Tokens → Parser → AST → Pattern Matcher → Results
```

## Pattern Syntax

ast-grep uses code-like patterns with meta-variables:

| Meta-variable | Matches | Example |
|---------------|---------|---------|
| `$NAME` | Single named node | `function $NAME()` matches `function foo()` |
| `$_` | Any single node (wildcard) | `const x: $_ = $_` matches any typed const |
| `$$$` | Zero or more nodes | `function $NAME($$$)` matches any params |

### Pattern Examples

```typescript
// Match function declarations
'function $NAME($$$) { $$$ }'      // function foo(a, b) { ... }
'async function $NAME($$$) { $$$ }' // async function bar() { ... }

// Match classes
'class $NAME extends $_ { $$$ }'   // class Foo extends Bar { ... }

// Match arrow functions
'const $NAME = ($$$) => $_'        // const fn = (x) => x * 2
```

## Architecture

```text
src/
├── parsers/
│   ├── language-registry.ts    # Extension → ast-grep Lang mapping
│   └── patterns/
│       ├── index.ts            # Language → patterns mapping
│       └── typescript.ts       # TS/JS patterns by symbol kind
└── search/
    └── symbol-search.ts        # Search engine using patterns
```

### Language Registry

Maps file extensions to ast-grep `Lang` enum:

```typescript
// language-registry.ts
const EXTENSION_TO_LANG: Record<string, Lang> = {
  '.ts': Lang.TypeScript,
  '.tsx': Lang.Tsx,
  '.js': Lang.JavaScript,
  // ...
};
```

### Pattern Definitions

Patterns organized by symbol kind:

```typescript
// patterns/typescript.ts
export const TYPESCRIPT_PATTERNS: Record<SymbolKind, string[]> = {
  function: [
    'function $NAME($$$) { $$$ }',
    'export function $NAME($$$) { $$$ }',
    // ...
  ],
  class: [
    'class $NAME { $$$ }',
    'class $NAME extends $_ { $$$ }',
    // ...
  ],
  // interface, type, method, variable, enum, constant
};
```

### Search Engine

[symbol-search.ts](../src/search/symbol-search.ts) processes files:

```typescript
// 1. Parse file once (performance optimization)
const ast = parse(lang, content);
const root = ast.root();

// 2. Run all patterns against the AST
for (const pattern of patterns) {
  const matches = root.findAll(pattern);

  for (const match of matches) {
    // 3. Extract captured meta-variables
    const nameNode = match.getMatch('NAME');
    const name = nameNode?.text();
    const range = match.range();

    // 4. Build result
    results.push({
      name,
      kind: options.kind,
      startLine: range.start.line + 1,
      // ...
    });
  }
}
```

## Supported Languages

| Language | Extensions | Patterns |
|----------|------------|----------|
| TypeScript | `.ts` | Full |
| TSX | `.tsx` | Full |
| JavaScript | `.js`, `.mjs`, `.cjs` | Full |
| JSX | `.jsx` | Full |

## Adding a New Language

### 1. Create pattern file

```typescript
// src/parsers/patterns/python.ts
import type { SymbolKind } from '../../types/symbols.js';

export const PYTHON_PATTERNS: Record<SymbolKind, string[]> = {
  function: [
    'def $NAME($$$): $$$',
    'async def $NAME($$$): $$$',
  ],
  class: [
    'class $NAME: $$$',
    'class $NAME($$$): $$$',
  ],
  // ...
};
```

### 2. Register in index

```typescript
// src/parsers/patterns/index.ts
import { PYTHON_PATTERNS } from './python.js';

export const LANGUAGE_PATTERNS: Record<string, LanguagePatterns> = {
  // ...existing...
  python: {
    patterns: PYTHON_PATTERNS,
  },
};
```

### 3. Add language mapping

```typescript
// src/parsers/language-registry.ts
const EXTENSION_TO_LANG: Record<string, Lang> = {
  // ...existing...
  '.py': Lang.Python,
};

const EXTENSION_TO_LANG_NAME: Record<string, string> = {
  // ...existing...
  '.py': 'python',
};
```

## Performance Considerations

1. **Parse once**: AST is parsed once per file, patterns iterate on the tree
2. **Pre-split lines**: Lines array created once for export checking
3. **Deduplication**: `Set` tracks seen symbols to avoid duplicates
4. **Early termination**: Stops when `maxResults` reached

## MCP Tools Using AST

| Tool | Description |
|------|-------------|
| `find_functions` | Find function/method definitions |
| `find_classes` | Find class definitions |
| `find_types` | Find type/interface/enum definitions |
| `find_symbol` | Generic symbol search by kind |

### Example Tool Call

```json
{
  "tool": "find_functions",
  "arguments": {
    "name": "handle*",
    "language": "typescript",
    "exportedOnly": true
  }
}
```

Returns:

```json
{
  "results": [
    {
      "name": "handleRequest",
      "kind": "function",
      "filePath": "/repo/src/server.ts",
      "startLine": 42,
      "signature": "export async function handleRequest(req: Request)",
      "exported": true
    }
  ]
}
```

## Text Search vs AST Search

| Criteria | Text (ripgrep) | AST (ast-grep) |
|----------|----------------|----------------|
| Speed | Faster | Slower |
| Accuracy | Pattern matching | Structural matching |
| Use case | Find occurrences | Find definitions |
| Example | "Where is X used?" | "Where is X defined?" |

Use **text search** for: finding usages, string literals, comments, configuration.
Use **AST search** for: finding definitions, extracting signatures, understanding structure.
