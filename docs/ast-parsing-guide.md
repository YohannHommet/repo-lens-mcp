# AST Parsing Guide

A comprehensive guide to Abstract Syntax Tree (AST) parsing, focusing on how it's used in the MCP Repo Search Server for intelligent code analysis.

## Table of Contents

1. [What is an AST?](#what-is-an-ast)
2. [AST vs Text Search](#ast-vs-text-search)
3. [How AST Parsing Works](#how-ast-parsing-works)
4. [ast-grep: Our AST Tool](#ast-grep-our-ast-tool)
5. [Pattern Syntax](#pattern-syntax)
6. [Practical Examples](#practical-examples)
7. [Language Support](#language-support)
8. [Performance Considerations](#performance-considerations)
9. [Limitations and Edge Cases](#limitations-and-edge-cases)
10. [Advanced Topics](#advanced-topics)

---

## What is an AST?

An **Abstract Syntax Tree (AST)** is a tree representation of the syntactic structure of source code. Unlike plain text, an AST understands the *meaning* and *structure* of code.

### Example: Simple Function

```typescript
function greet(name: string): string {
  return `Hello, ${name}!`;
}
```

**Text representation**: Just characters and lines.

**AST representation**:

```
FunctionDeclaration
├── name: Identifier("greet")
├── parameters: [
│   └── Parameter
│       ├── name: Identifier("name")
│       └── type: TypeAnnotation("string")
│   ]
├── returnType: TypeAnnotation("string")
└── body: BlockStatement
    └── ReturnStatement
        └── TemplateLiteral
            ├── quasis: ["Hello, ", "!"]
            └── expressions: [Identifier("name")]
```

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Node** | A single element in the tree (function, variable, expression, etc.) |
| **Parent/Child** | Hierarchical relationship between nodes |
| **Leaf** | A node with no children (identifiers, literals) |
| **Root** | The top-level node (usually "Program" or "SourceFile") |
| **Traversal** | Walking through the tree (depth-first, breadth-first) |

---

## AST vs Text Search

### Why Not Just Use grep/ripgrep?

| Scenario | Text Search (ripgrep) | AST Search |
|----------|----------------------|------------|
| Find `function` keyword | Matches ALL occurrences | Only actual function declarations |
| Find `User` | Matches in comments, strings, code | Only actual symbol usage |
| Find function calls | Regex gets complex | Natural pattern matching |
| Rename a variable | Dangerous, may hit wrong matches | Precise, semantic awareness |

### Example: Finding Functions

**Code sample:**

```typescript
// This function handles users
const description = "function to process";
function handleUsers() { }  // <-- We want only this
const arrow = () => {};     // <-- And this
```

**Text search for `function`:**

- Line 1: `// This function handles users` ❌ (comment)
- Line 2: `"function to process"` ❌ (string)
- Line 3: `function handleUsers()` ✅ (actual function)

**AST search for FunctionDeclaration:**

- Line 3: `function handleUsers()` ✅

**AST search for ArrowFunction:**

- Line 4: `() => {}` ✅

### When to Use Each

| Use Text Search When... | Use AST Search When... |
|-------------------------|------------------------|
| Searching for literal strings | Finding specific code constructs |
| Log messages, comments | Function/class/type definitions |
| Configuration values | Refactoring operations |
| Quick exploratory search | Precise symbol extraction |
| Cross-language search | Language-specific analysis |

---

## How AST Parsing Works

### The Parsing Pipeline

```text
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Source Code │ ──▶ │    Lexer     │ ──▶ │    Parser    │
│   (string)   │     │  (tokenize)  │     │ (build tree) │
└──────────────┘     └──────────────┘     └──────────────┘
                                                 │
                                                 ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Results    │ ◀── │   Matcher    │ ◀── │     AST      │
│              │     │  (patterns)  │     │   (tree)     │
└──────────────┘     └──────────────┘     └──────────────┘
```

### Step 1: Lexical Analysis (Tokenization)

The lexer breaks source code into tokens:

```typescript
function add(a, b) { return a + b; }
```

Becomes:

```text
[KEYWORD:function] [IDENTIFIER:add] [LPAREN] [IDENTIFIER:a] [COMMA]
[IDENTIFIER:b] [RPAREN] [LBRACE] [KEYWORD:return] [IDENTIFIER:a]
[PLUS] [IDENTIFIER:b] [SEMICOLON] [RBRACE]
```

### Step 2: Syntactic Analysis (Parsing)

The parser builds a tree from tokens:

```text
FunctionDeclaration
├── name: "add"
├── params: ["a", "b"]
└── body: BlockStatement
    └── ReturnStatement
        └── BinaryExpression
            ├── left: "a"
            ├── operator: "+"
            └── right: "b"
```

### Step 3: Pattern Matching

We query the AST with patterns to find specific structures.

---

## ast-grep: Our AST Tool

[ast-grep](https://ast-grep.github.io/) is a fast, polyglot tool for structural code search. It uses [tree-sitter](https://tree-sitter.github.io/) parsers under the hood.

### Why ast-grep?

| Feature | Benefit |
|---------|---------|
| **Fast** | Written in Rust, highly optimized |
| **Multi-language** | One tool for TS, JS, Python, Go, etc. |
| **Pattern-based** | Write patterns that look like code |
| **Node.js bindings** | `@ast-grep/napi` for programmatic use |

### Installation

```bash
npm install @ast-grep/napi
```

### Basic Usage

```typescript
import { parse, Lang } from '@ast-grep/napi';

const code = `
function hello(name: string) {
  console.log("Hello", name);
}
`;

const ast = parse(Lang.TypeScript, code);
const root = ast.root();

// Find all function declarations
const functions = root.findAll('function $NAME($$$) { $$$ }');

for (const fn of functions) {
  const name = fn.getMatch('NAME');
  console.log('Found function:', name?.text());
}
```

---

## Pattern Syntax

ast-grep uses a pattern language that looks like the code you're searching for, with special meta-variables for wildcards.

### Meta-Variables

| Meta-Variable | Matches | Example |
|---------------|---------|---------|
| `$NAME` | Single AST node | `function $NAME()` matches any function name |
| `$$$` | Zero or more nodes | `function $NAME($$$)` matches any parameters |
| `$_` | Any single node (anonymous) | `const $_ = $_` matches any const assignment |

### Basic Patterns

#### Functions

```
// Named function
function $NAME($$$PARAMS) { $$$ }

// Arrow function assigned to const
const $NAME = ($$$PARAMS) => $$$

// Async function
async function $NAME($$$) { $$$ }

// Exported function
export function $NAME($$$) { $$$ }
```

#### Classes

```
// Basic class
class $NAME { $$$ }

// Class with extends
class $NAME extends $PARENT { $$$ }

// Exported class
export class $NAME { $$$ }

// Abstract class
abstract class $NAME { $$$ }
```

#### Types and Interfaces

```
// Type alias
type $NAME = $$$

// Interface
interface $NAME { $$$ }

// Exported type
export type $NAME = $$$

// Interface with extends
interface $NAME extends $PARENT { $$$ }
```

#### Variables

```
// Const
const $NAME = $VALUE

// Let
let $NAME = $VALUE

// Destructuring
const { $NAME } = $SOURCE

// Array destructuring
const [$FIRST, $$$REST] = $SOURCE
```

### Pattern Matching Rules

1. **Exact match**: Literal code matches exactly

   ```
   console.log($MSG)  // Matches console.log("hello")
   ```

2. **Wildcard match**: Meta-variables match any valid AST node

   ```
   $OBJ.$METHOD($$$)  // Matches any method call on any object
   ```

3. **Structural match**: Tree structure must match

   ```
   if ($COND) { $$$ }  // Matches if statements (not ternary)
   ```

---

## Practical Examples

### Example 1: Find All React Components

```typescript
// Functional components
const patterns = [
  'function $NAME($PROPS): JSX.Element { $$$ }',
  'const $NAME = ($PROPS) => { $$$ }',
  'const $NAME: React.FC<$PROPS> = ($$$) => $$$',
  'export default function $NAME($$$) { $$$ }',
];
```

### Example 2: Find API Route Handlers (Express)

```typescript
// Express routes
const expressPatterns = [
  'app.get($PATH, $$$)',
  'app.post($PATH, $$$)',
  'app.put($PATH, $$$)',
  'app.delete($PATH, $$$)',
  'router.get($PATH, $$$)',
  'router.post($PATH, $$$)',
];
```

### Example 3: Find All Imports from a Module

```typescript
// Import patterns
const importPatterns = [
  'import { $$$ } from "$MODULE"',
  'import $DEFAULT from "$MODULE"',
  'import * as $NAMESPACE from "$MODULE"',
  'import $DEFAULT, { $$$ } from "$MODULE"',
];
```

### Example 4: Find Unsafe Patterns

```typescript
// Security anti-patterns
const unsafePatterns = [
  'eval($CODE)',                    // eval() usage
  'innerHTML = $VALUE',             // innerHTML assignment
  'document.write($$$)',            // document.write
  'new Function($$$)',              // Function constructor
  'dangerouslySetInnerHTML={{ __html: $$$ }}', // React dangerous
];
```

### Example 5: Find Console Statements

```typescript
const consolePatterns = [
  'console.log($$$)',
  'console.error($$$)',
  'console.warn($$$)',
  'console.debug($$$)',
  'console.info($$$)',
];
```

### Full Code Example: Extract Functions

```typescript
import { parse, Lang } from '@ast-grep/napi';
import { readFile } from 'fs/promises';

interface FunctionInfo {
  name: string;
  line: number;
  signature: string;
  exported: boolean;
}

async function extractFunctions(filePath: string): Promise<FunctionInfo[]> {
  const content = await readFile(filePath, 'utf-8');
  const ast = parse(Lang.TypeScript, content);
  const root = ast.root();
  const lines = content.split('\n');

  const patterns = [
    'function $NAME($$$PARAMS) { $$$ }',
    'async function $NAME($$$PARAMS) { $$$ }',
    'export function $NAME($$$PARAMS) { $$$ }',
    'export async function $NAME($$$PARAMS) { $$$ }',
    'const $NAME = ($$$PARAMS) => $$$',
    'const $NAME = async ($$$PARAMS) => $$$',
  ];

  const functions: FunctionInfo[] = [];
  const seen = new Set<string>();

  for (const pattern of patterns) {
    const matches = root.findAll(pattern);

    for (const match of matches) {
      const nameNode = match.getMatch('NAME');
      const name = nameNode?.text() || 'anonymous';
      const line = match.range().start.line;
      const key = `${name}:${line}`;

      if (seen.has(key)) continue;
      seen.add(key);

      const lineContent = lines[line];
      const exported = lineContent.trimStart().startsWith('export');

      functions.push({
        name,
        line: line + 1, // 1-indexed
        signature: lineContent.trim().replace(/\{.*$/, '').trim(),
        exported,
      });
    }
  }

  return functions;
}

// Usage
const functions = await extractFunctions('./src/index.ts');
console.log(functions);
```

---

## Language Support

### Supported Languages in ast-grep

| Language | Lang Enum | Extensions |
|----------|-----------|------------|
| TypeScript | `Lang.TypeScript` | `.ts` |
| TSX | `Lang.Tsx` | `.tsx` |
| JavaScript | `Lang.JavaScript` | `.js`, `.jsx`, `.mjs`, `.cjs` |
| Python | `Lang.Python` | `.py` |
| Go | `Lang.Go` | `.go` |
| Rust | `Lang.Rust` | `.rs` |
| Java | `Lang.Java` | `.java` |
| C | `Lang.C` | `.c`, `.h` |
| C++ | `Lang.Cpp` | `.cpp`, `.hpp`, `.cc` |
| C# | `Lang.CSharp` | `.cs` |
| Ruby | `Lang.Ruby` | `.rb` |
| Swift | `Lang.Swift` | `.swift` |
| Kotlin | `Lang.Kotlin` | `.kt` |
| PHP | `Lang.Php` | `.php` |
| Lua | `Lang.Lua` | `.lua` |
| HTML | `Lang.Html` | `.html` |
| CSS | `Lang.Css` | `.css` |
| JSON | `Lang.Json` | `.json` |
| YAML | `Lang.Yaml` | `.yaml`, `.yml` |

### Language-Specific Patterns

#### TypeScript/JavaScript

```
// Type annotation
const $NAME: $TYPE = $VALUE

// Generic function
function $NAME<$T>($$$): $RET { $$$ }

// Decorator
@$DECORATOR
class $NAME { $$$ }
```

#### Python

```
# Function definition
def $NAME($$$):
    $$$

# Class definition
class $NAME($$$):
    $$$

# Decorator
@$DECORATOR
def $NAME($$$):
    $$$
```

#### Go

```
// Function
func $NAME($$$) $RET { $$$ }

// Method
func ($RECV $TYPE) $NAME($$$) $RET { $$$ }

// Struct
type $NAME struct { $$$ }

// Interface
type $NAME interface { $$$ }
```

#### PHP

```
// Function
function $NAME($$$) { $$$ }

// Method
public function $NAME($$$) { $$$ }

// Class
class $NAME { $$$ }
```

---

## Performance Considerations

### Parsing Cost

| Operation | Relative Cost | Notes |
|-----------|--------------|-------|
| Parse file | High | Do once per file |
| Pattern match | Medium | Linear in AST size |
| Get match | Low | Direct node access |

### Optimization Strategies

#### 1. Parse Once, Query Multiple Times

```typescript
// BAD - Parses for each pattern
for (const pattern of patterns) {
  const ast = parse(lang, content);  // Redundant!
  const matches = ast.root().findAll(pattern);
}

// GOOD - Parse once
const ast = parse(lang, content);
const root = ast.root();
for (const pattern of patterns) {
  const matches = root.findAll(pattern);
}
```

#### 2. Pre-split Content for Line Operations

```typescript
// BAD - Splits on every check
function isExported(content: string, line: number): boolean {
  const lines = content.split('\n');  // Expensive for large files!
  return lines[line].startsWith('export');
}

// GOOD - Split once
const lines = content.split('\n');
for (const match of matches) {
  const exported = lines[match.range().start.line].startsWith('export');
}
```

#### 3. Early Termination

```typescript
// Stop searching when we have enough results
for (const filePath of files) {
  if (results.length >= maxResults) break;
  // ...
}
```

#### 4. Filter Files Before Parsing

```typescript
// Skip files that can't contain what we want
const files = await fg(['**/*.ts'], {
  ignore: ['**/*.d.ts', '**/*.test.ts', '**/node_modules/**'],
});
```

### Memory Considerations

- AST objects can be large (10-100x source size)
- Don't keep ASTs in memory longer than needed
- Process files sequentially for large codebases, not all at once

---

## Limitations and Edge Cases

### 1. Dynamic Code

AST parsing cannot analyze dynamically generated code:

```typescript
// Can't statically analyze
const methodName = 'handle' + action;
obj[methodName]();

// Can't parse
eval('function foo() {}');
```

### 2. Complex Expressions

Some patterns are hard to express:

```typescript
// Hard to match: function call with specific number of arguments
someFunc(a, b, c)  // How to match exactly 3 args?

// Workaround: Match all, filter in code
const matches = root.findAll('someFunc($$$ARGS)');
const threeArgs = matches.filter(m =>
  m.getMatch('ARGS')?.text().split(',').length === 3
);
```

### 3. Comments and Whitespace

AST typically ignores comments:

```typescript
// This comment won't be in the AST
function foo() {}
```

To find comments, use text search or tree-sitter's comment handling.

### 4. Syntax Errors

Files with syntax errors may:

- Fail to parse entirely
- Parse partially (tree-sitter is error-tolerant)

```typescript
try {
  const ast = parse(Lang.TypeScript, invalidCode);
} catch (error) {
  // Handle parse failure
}
```

### 5. Macro-heavy Code (C/C++)

Preprocessor macros aren't expanded:

```c
#define FUNC(name) void name() {}
FUNC(hello)  // AST sees FUNC(hello), not void hello() {}
```

---

## Advanced Topics

### Custom Pattern Matching

When ast-grep patterns aren't enough, traverse the AST manually:

```typescript
import { parse, Lang, SgNode } from '@ast-grep/napi';

function findDeepPatterns(root: SgNode): SgNode[] {
  const results: SgNode[] = [];

  function traverse(node: SgNode) {
    // Custom logic
    if (node.kind() === 'call_expression') {
      const callee = node.child(0);
      if (callee?.text() === 'require') {
        results.push(node);
      }
    }

    // Recurse
    for (const child of node.children()) {
      traverse(child);
    }
  }

  traverse(root);
  return results;
}
```

### AST Node Properties

```typescript
const node: SgNode = /* ... */;

// Node information
node.kind();        // Node type (e.g., 'function_declaration')
node.text();        // Source code text
node.range();       // { start: {line, column}, end: {line, column} }

// Navigation
node.parent();      // Parent node
node.children();    // Child nodes array
node.child(0);      // First child
node.next();        // Next sibling
node.prev();        // Previous sibling

// Pattern matching
node.matches('$PATTERN');        // Boolean
node.find('$PATTERN');           // First match or null
node.findAll('$PATTERN');        // All matches array
node.getMatch('META_VAR');       // Get captured meta-variable
```

### Combining AST with Other Analysis

```typescript
// AST + Git: Find recently modified functions
async function findRecentlyChangedFunctions(repoPath: string) {
  // Get recently changed files from git
  const git = simpleGit(repoPath);
  const diff = await git.diff(['--name-only', 'HEAD~10']);
  const changedFiles = diff.split('\n').filter(f => f.endsWith('.ts'));

  // Parse and extract functions from changed files
  const functions = [];
  for (const file of changedFiles) {
    const content = await readFile(join(repoPath, file), 'utf-8');
    const ast = parse(Lang.TypeScript, content);
    const matches = ast.root().findAll('function $NAME($$$) { $$$ }');
    functions.push(...matches.map(m => ({
      file,
      name: m.getMatch('NAME')?.text(),
    })));
  }

  return functions;
}
```

### Building a Code Linter

```typescript
interface LintRule {
  name: string;
  pattern: string;
  message: string;
  severity: 'error' | 'warning';
}

const rules: LintRule[] = [
  {
    name: 'no-console',
    pattern: 'console.$METHOD($$$)',
    message: 'Unexpected console statement',
    severity: 'warning',
  },
  {
    name: 'no-eval',
    pattern: 'eval($$$)',
    message: 'eval() is dangerous',
    severity: 'error',
  },
];

function lint(code: string, lang: Lang): LintResult[] {
  const ast = parse(lang, code);
  const root = ast.root();
  const results: LintResult[] = [];

  for (const rule of rules) {
    const matches = root.findAll(rule.pattern);
    for (const match of matches) {
      results.push({
        rule: rule.name,
        message: rule.message,
        severity: rule.severity,
        line: match.range().start.line + 1,
        column: match.range().start.column + 1,
      });
    }
  }

  return results;
}
```

---

## References

- [ast-grep Documentation](https://ast-grep.github.io/)
- [ast-grep Pattern Syntax](https://ast-grep.github.io/guide/pattern-syntax.html)
- [ast-grep API Reference](https://ast-grep.github.io/reference/api.html)
- [Tree-sitter](https://tree-sitter.github.io/)
- [Tree-sitter Playground](https://tree-sitter.github.io/tree-sitter/playground)
- [@ast-grep/napi on npm](https://www.npmjs.com/package/@ast-grep/napi)

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│                    AST-GREP QUICK REFERENCE                  │
├─────────────────────────────────────────────────────────────┤
│ META-VARIABLES                                               │
│   $NAME      Single node capture                            │
│   $$$        Zero or more nodes                             │
│   $_         Anonymous single node                          │
├─────────────────────────────────────────────────────────────┤
│ COMMON PATTERNS (TypeScript/JavaScript)                      │
│   function $NAME($$$) { $$$ }     Named function            │
│   const $NAME = ($$$) => $$$      Arrow function            │
│   class $NAME { $$$ }             Class definition          │
│   interface $NAME { $$$ }         Interface                 │
│   type $NAME = $$$                Type alias                │
│   import { $$$ } from "$_"        Named import              │
│   export const $NAME = $$$        Exported const            │
├─────────────────────────────────────────────────────────────┤
│ API USAGE                                                    │
│   parse(Lang.TypeScript, code)    Parse code to AST         │
│   ast.root()                      Get root node             │
│   root.findAll(pattern)           Find all matches          │
│   root.find(pattern)              Find first match          │
│   match.getMatch('NAME')          Get captured variable     │
│   node.text()                     Get source text           │
│   node.range()                    Get line/column range     │
└─────────────────────────────────────────────────────────────┘
```
