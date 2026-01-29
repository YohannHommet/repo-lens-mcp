# repo-lens-mcp Refactoring Plan v0.2.0

**Created:** 2026-01-29
**Status:** Ready for Implementation
**Breaking Changes:** Yes (v0.1.x → v0.2.0)

---

## Executive Summary

This refactoring transforms repo-lens-mcp from a general-purpose code search tool into a **specialized multi-repository AST-based symbol and API discovery tool**. The goal is to remove features that duplicate Claude Code's capabilities and focus on the unique value: cross-repository structural code search.

### Key Changes
- **Remove:** Text search, file operations, caching, metadata collection, 3 unused symbol tools
- **Keep:** Multi-repo management, AST symbol search (3 core tools), API route discovery
- **Result:** Simpler, faster, focused tool with 40% less code

### Impact
- ✅ Repository registration: 5-30s → < 1 second
- ✅ Tools reduced: 15 → 9
- ✅ Dependencies removed: 2 (ripgrep, lru-cache)
- ✅ Configuration simplified: 8 env vars → 2
- ✅ Package size reduced: ~50MB

---

## Vision & Philosophy

### Current Problem
repo-lens-mcp tries to do too much, duplicating functionality that Claude Code already provides natively (text search via Grep, file operations via Read/Glob). This creates:
- Redundancy with existing tools
- Slower performance (MCP protocol overhead)
- Higher complexity and maintenance burden
- Unclear value proposition

### Solution
Focus exclusively on what Claude Code **cannot** do efficiently:
1. **Cross-repository AST search** - Find symbols across multiple projects simultaneously
2. **Structural code understanding** - Distinguish `class User` from `const User`
3. **API route mapping** - Discover all endpoints across microservices architecturally

### Use Cases
```
Scenario 1: Frontend developer needs backend API routes
→ Stay in frontend/, query backend/ APIs without switching context

Scenario 2: Check if function exists across multiple services
→ Search all microservices from one command, avoid duplicates

Scenario 3: Map authentication endpoints across architecture
→ Find all auth routes in 5 services without opening each repo
```

---

## Target Architecture

### Before (Current)
```
15 tools across 5 categories:
├── Repository (5): register, unregister, list, get_info, refresh
├── Search (1): search_text ← REMOVE
├── Symbol (6): find_functions, classes, types, enums, vars, consts ← REDUCE TO 3
├── API (1): find_api_routes
└── File (2): get_file, get_file_info ← REMOVE

4 search engines:
├── TextSearchEngine ← REMOVE
├── FileSearchEngine ← REMOVE
├── SymbolSearchEngine (AST)
└── APIRouteSearchEngine (AST)

Additional complexity:
├── SearchCache (LRU + TTL) ← REMOVE
├── RepositoryScanner (metadata collection) ← SIMPLIFY
└── 8 configuration variables ← REDUCE TO 2
```

### After (Target)
```
9 tools across 3 categories:
├── Repository (5): register, unregister, list, get_info, refresh
├── Symbol (3): find_functions, find_classes, find_types
└── API (1): find_api_routes

2 search engines:
├── SymbolSearchEngine (AST-based, powered by Rust ast-grep)
└── APIRouteSearchEngine (framework detection)

Core components:
├── RepositoryManager (lightweight, instant registration)
├── RepositoryScanner (git validation only, no metadata)
└── ConfigStore (persistence only)
```

---

## MCP Best Practices (Must Maintain)

Throughout this refactoring, strictly maintain these MCP patterns:

### 1. Tool Registration Pattern
```typescript
server.tool(
  'tool_name',                    // snake_case, verb-noun format
  'Human-readable description',   // Clear purpose
  {                               // Zod schema
    param: z.string().describe('Documentation'),
    optional: z.number().optional().describe('Optional param'),
  },
  async ({ param, optional }) => {  // Type-safe handler
    try {
      // Implementation
      return { content: [{ type: 'text', text: result }] }
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true  // Flag errors
      }
    }
  }
)
```

### 2. Schema Validation Rules
- ✅ Every parameter must have `.describe()` documentation
- ✅ Use `.optional()` for optional parameters
- ✅ Mention defaults in descriptions (e.g., "default: false")
- ✅ Arrays: `z.array(z.string())`
- ✅ Security: Validate inputs, prevent ReDoS

### 3. Error Handling Standard
- ✅ **NEVER throw** from tool handlers
- ✅ Always wrap in try-catch
- ✅ Return errors as responses with `isError: true`
- ✅ Extract user-friendly messages: `error.message`

### 4. Response Format Standards
```typescript
// Success
{ content: [{ type: 'text', text: '...' }] }

// Error
{ content: [{ type: 'text', text: 'Error: ...' }], isError: true }

// Formatting
- Markdown for human-readable output
- Code blocks with language hints (```typescript)
- Tables for structured data
- JSON.stringify with pretty printing (null, 2)
```

### 5. Type Safety Requirements
- ✅ Full TypeScript typing throughout
- ✅ No `any` types except where absolutely necessary
- ✅ Proper interface definitions for all data structures
- ✅ Zero TypeScript errors on compilation

### 6. Security Patterns
- ✅ Path validation (no traversal attacks)
- ✅ Symlink resolution and verification
- ✅ Input validation via Zod schemas
- ✅ ReDoS prevention for regex patterns (if applicable)

### 7. Logging & Resource Management
- ✅ Structured logging to stderr: `logger.info('msg', { data })`
- ✅ Graceful shutdown with SIGINT/SIGTERM handlers
- ✅ Immediate persistence of state changes

---

## Implementation Phases

### Phase 1: Remove Caching System

**Why:** Caching adds complexity without real benefit. Users won't ask the same question twice in a session. Adds ~200 LOC and maintenance burden.

**Delete:**
- `src/utils/cache.ts` (entire file)

**Modify:**
- `src/index.ts`
  - Remove: `import { SearchCache } from './utils/cache.js'`
  - Remove: SearchCache instantiation (lines 33-36)
  - Update tool registrations: Remove `searchCache` parameter
- `src/tools/repository-tools.ts`
  - Remove SearchCache parameter from function signature
  - Remove `searchCache.clear()` calls (3 locations)
- `src/tools/symbol-tools.ts`
  - Remove cache checking logic from 3 tools:
    - `find_functions`
    - `find_classes`
    - `find_types`
  - Remove cache key generation
  - Remove cache set operations
  - Remove "(cached)" indicators from output
- `src/tools/api-tools.ts`
  - Remove cache checking logic from `find_api_routes`
- `src/config/types.ts`
  - Remove: `cacheEnabled`, `cacheTtl`, `cacheMaxEntries` fields
- `src/config/index.ts`
  - Remove cache configuration loading

**MCP Best Practice Check:**
- ✅ Ensure error handling remains intact (try-catch, no throws)
- ✅ Verify response format consistency maintained
- ✅ No breaking changes to tool signatures

**Feedback Loop:**
```bash
npm run build        # Verify compiles
npm run lint         # Check for unused imports
npm test             # Ensure tests pass
git add . && git commit -m "Phase 1: Remove caching system"

# Manual test
npm run dev
# Verify tools still work, no cache references
```

**Expected:** Server starts successfully, tools respond without cache overhead

---

### Phase 2: Remove Unused Symbol Tools

**Why:** `find_enums`, `find_variables`, `find_constants` are rarely used. 80% of use cases covered by functions + classes. Types useful for TypeScript. Enums/vars/consts too granular.

**Modify:**
- `src/tools/symbol-tools.ts`
  - **Remove** `find_enums` tool handler (~lines 306-342)
  - **Remove** `find_variables` tool handler (~lines 383-418)
  - **Remove** `find_constants` tool handler (~lines 460-496)
  - **Keep** only 3 tools:
    - `find_functions` (functions, methods, arrow functions)
    - `find_classes` (class definitions)
    - `find_types` (interfaces, type aliases)

**MCP Best Practice Check:**
- ✅ Verify remaining 3 tools maintain proper error handling
- ✅ Ensure Zod schemas still have `.describe()` on all parameters
- ✅ Confirm response format consistency
- ✅ Update function signature if needed (remove enum/var/const kinds)

**Feedback Loop:**
```bash
npm run build
npm run typecheck
npm test
git add . && git commit -m "Phase 2: Remove find_enums, find_variables, find_constants"

# Manual test: Verify 3 core tools work
npm run dev
# Test find_functions, find_classes, find_types
```

**Expected:** Only 3 symbol tools registered, all functional

---

### Phase 3: Remove Text Search Engine

**Why:** Duplicates Claude Code's Grep tool. Adds 50MB ripgrep binary. MCP protocol overhead makes it slower than native Grep. Users should use Claude's built-in Grep instead.

**Delete:**
- `src/search/text-search.ts` (entire file)
- `src/tools/search-tools.ts` (entire file)

**Modify:**
- `src/index.ts`
  - Remove: `import { TextSearchEngine } from './search/text-search.js'`
  - Remove: `import { registerSearchTools } from './tools/index.js'`
  - Remove: `const textSearch = new TextSearchEngine(config.searchTimeout)`
  - Remove: `registerSearchTools(...)` call
- `src/tools/index.ts`
  - Remove: `export * from './search-tools.js'`
- `package.json`
  - Remove: `"@vscode/ripgrep": "^1.17.0"`
- `src/types/search.ts` (if exists)
  - Remove: `TextSearchOptions` and `TextSearchResult` interfaces

**MCP Best Practice Check:**
- ✅ Ensure remaining tools still follow proper patterns
- ✅ No broken imports or references to TextSearchEngine

**Feedback Loop:**
```bash
npm uninstall @vscode/ripgrep
npm run build
npm test
git add . && git commit -m "Phase 3: Remove text search engine"

# Verify package size reduction
du -sh node_modules/  # Should be ~50MB smaller
ls -lh dist/          # Check build output size
```

**Expected:** Ripgrep dependency removed, build successful, no references remain

---

### Phase 4: Remove File Search Engine

**Why:** Duplicates Claude Code's Read/Glob tools. File operations (get_file, get_file_info) add latency via MCP. Users should use Claude's native file operations.

**Delete:**
- `src/search/file-search.ts` (entire file)
- `src/tools/file-tools.ts` (entire file)

**Modify:**
- `src/index.ts`
  - Remove: `import { FileSearchEngine } from './search/file-search.js'`
  - Remove: `import { registerFileTools } from './tools/index.js'`
  - Remove: `const fileSearch = new FileSearchEngine()`
  - Remove: `registerFileTools(...)` call
- `src/tools/index.ts`
  - Remove: `export * from './file-tools.js'`
- `src/types/search.ts` (if exists)
  - Remove: `FileSearchOptions` and `FileSearchResult` interfaces

**MCP Best Practice Check:**
- ✅ Ensure no other components depend on FileSearchEngine
- ✅ Path utilities still available for security validation

**Feedback Loop:**
```bash
npm run build
npm test
git add . && git commit -m "Phase 4: Remove file search engine"

# Verify clean architecture
npm run lint
grep -r "FileSearchEngine" src/  # Should return nothing
```

**Expected:** File operations removed, core AST tools still work

---

### Phase 5: Simplify Repository Scanner

**Why:** Current scanner collects unused metadata (languages, file counts) which makes registration slow (5-30s for large repos). We only need git info. Users want instant registration.

**Simplify:**
- `src/core/repository-scanner.ts`
  - Simplify `scan()` method:
    ```typescript
    // BEFORE
    async scan(path: string): Promise<{
      gitInfo: GitInfo
      languages: string[]
      fileCount: number
    }>

    // AFTER
    async scan(path: string): Promise<{ gitInfo: GitInfo }> {
      const gitInfo = await getGitInfo(path)
      return { gitInfo }
    }
    ```
  - **Delete** methods:
    - `detectLanguages()` (~lines 39-63)
    - `countFiles()` (~lines 65-77)

**Update Types:**
- `src/types/repository.ts`
  ```typescript
  // BEFORE
  export interface Repository {
    id: string
    path: string
    alias?: string
    tags: string[]
    gitInfo: GitInfo
    languages: string[]      // ← REMOVE
    lastScanned: Date        // ← REMOVE
    fileCount: number        // ← REMOVE
  }

  // AFTER
  export interface Repository {
    id: string
    path: string
    alias?: string
    tags: string[]
    gitInfo: GitInfo
    registeredAt: Date       // ← NEW (replace lastScanned)
  }
  ```

- `src/config/types.ts`
  - Update `SerializedRepository` to match (remove languages, fileCount, lastScanned)
  - Add `registeredAt: string`

**Update Managers:**
- `src/core/repository-manager.ts`
  - Update `register()` method:
    ```typescript
    // Change
    const { gitInfo, languages, fileCount } = await this.scanner.scan(normalizedPath)
    // To
    const { gitInfo } = await this.scanner.scan(normalizedPath)

    // Update repository object
    const repository: Repository = {
      // ... other fields
      gitInfo,
      registeredAt: new Date(),  // NEW
      // Remove: languages, fileCount, lastScanned
    }
    ```
  - Update `refresh()` method: Only update gitInfo

- `src/core/config-store.ts`
  - Update serialization: `registeredAt: repo.registeredAt.toISOString()`
  - Update deserialization: `registeredAt: new Date(serialized.registeredAt)`

**Update Tools:**
- `src/tools/repository-tools.ts`
  - Remove from `register_repository` response: languages, fileCount
  - Remove from `list_repositories` output: languages, fileCount
  - Remove from `refresh_repository` response: languages, fileCount, lastScanned
  - Keep: id, path, alias, tags, gitInfo, registeredAt

**MCP Best Practice Check:**
- ✅ All tools maintain proper error handling
- ✅ Response formats remain consistent
- ✅ Type safety preserved (no any types)

**Feedback Loop:**
```bash
npm run build
npm run typecheck  # Verify type changes are correct
npm test
git add . && git commit -m "Phase 5: Simplify repository scanner"

# CRITICAL TEST: Verify registration speed
time node dist/index.js &
# Then register a large repo - should complete in < 1 second
```

**Expected:** Repository registration is instant, no metadata collection, types updated

---

### Phase 6: Clean Up Dependencies

**Why:** Remove packages no longer needed after removing text search and caching.

**Remove:**
```bash
npm uninstall lru-cache  # (ripgrep already removed in Phase 3)
```

**Keep:**
- `@ast-grep/napi` - Core AST parsing (Rust)
- `@modelcontextprotocol/sdk` - MCP server
- `fast-glob` - File discovery (used by symbol + API search)
- `simple-git` - Git operations
- `async-mutex` - Concurrency control (ConfigStore)
- `zod` - Schema validation

**Feedback Loop:**
```bash
npm uninstall lru-cache
npm install  # Update lockfile
npm audit    # Check vulnerabilities
npm run build
npm test
git add . && git commit -m "Phase 6: Clean up unused dependencies"

# Verify only essential deps remain
npm list --depth=0
```

**Expected:** Dependency list reduced, all tests pass

---

### Phase 7: Simplify Configuration

**Why:** Remove configuration for features we deleted (cache, text search, file size limits).

**Simplify:**
- `src/config/types.ts`
  ```typescript
  // BEFORE (8 config vars)
  export interface ServerConfig {
    configDir: string
    maxSearchResults: number
    maxFileSize: number
    searchTimeout: number
    cacheEnabled: boolean
    cacheTtl: number
    cacheMaxEntries: number
    logLevel: 'debug' | 'info' | 'warn' | 'error'
  }

  // AFTER (2 config vars)
  export interface ServerConfig {
    configDir: string
    logLevel: 'debug' | 'info' | 'warn' | 'error'
  }
  ```

- `src/config/index.ts`
  ```typescript
  export function loadConfig(): ServerConfig {
    const configDir =
      process.env.MCP_REPO_SEARCH_CONFIG_DIR?.replace('~', homedir())
      || join(homedir(), '.config', 'mcp-repo-search')

    return {
      configDir,
      logLevel: (['debug', 'info', 'warn', 'error'].includes(process.env.MCP_LOG_LEVEL || '')
        ? process.env.MCP_LOG_LEVEL
        : 'info') as ServerConfig['logLevel'],
    }
  }
  ```

**Remove config usage:**
- `src/tools/symbol-tools.ts` - Config no longer needed in handlers
- `src/tools/api-tools.ts` - Config no longer needed in handlers

**MCP Best Practice Check:**
- ✅ Configuration still loaded at startup
- ✅ Passed via dependency injection
- ✅ Type-safe access

**Feedback Loop:**
```bash
npm run build
npm run typecheck
npm test
git add . && git commit -m "Phase 7: Simplify configuration"

# Test with different log levels
MCP_LOG_LEVEL=debug npm run dev
MCP_LOG_LEVEL=error npm run dev
```

**Expected:** Only 2 environment variables work correctly

---

### Phase 8: Update Documentation

**Why:** Documentation must reflect new architecture and clearly explain the multi-repo value proposition.

**Create:**
- `docs/MIGRATION.md`
  ```markdown
  # Migration Guide: v0.1.x to v0.2.0

  ## Breaking Changes

  ### Removed Tools (6 total)
  - `search_text` → Use Claude Code's Grep tool
  - `get_file` → Use Claude Code's Read tool
  - `get_file_info` → Use Claude Code's file operations
  - `list_dir` → Use Claude Code's Glob tool
  - `find_enums` → Use find_types or AST patterns
  - `find_variables` → Rarely needed, removed
  - `find_constants` → Rarely needed, removed

  ### Repository Object Changes
  Removed: languages, fileCount, lastScanned
  Added: registeredAt

  ### Configuration Changes
  Removed: MCP_CACHE_ENABLED, MCP_CACHE_TTL_MS, MCP_CACHE_MAX_ENTRIES,
           MCP_MAX_SEARCH_RESULTS, MCP_MAX_FILE_SIZE_MB, MCP_SEARCH_TIMEOUT_MS
  Kept: MCP_REPO_SEARCH_CONFIG_DIR, MCP_LOG_LEVEL

  ## Benefits
  - Registration: 5-30s → < 1s
  - Package size: -50MB
  - Code: -40%
  - Focus: Multi-repo AST search
  ```

**Modify:**
- `README.md`
  - Update overview: Emphasize multi-repository AST search
  - Add "Why Use This?" section:
    ```markdown
    ## Why Use This?

    **Claude Code can't do:**
    - Search for symbols across multiple repositories simultaneously
    - Understand code structure (distinguishes class vs variable)
    - Map API routes across microservices architecturally

    **Use repo-lens-mcp when:**
    - Working in frontend, need backend API routes
    - Checking if functions exist across multiple services
    - Mapping authentication across 5 microservices
    - Avoiding duplicate code in monorepos

    **Use Claude Code when:**
    - Text search in current repo (Grep tool)
    - Reading files in current repo (Read tool)
    - Finding files by pattern (Glob tool)
    ```
  - Update capabilities: Remove text search, file operations
  - List only 3 symbol tools: find_functions, find_classes, find_types
  - Simplify configuration: Show only 2 env vars
  - Update examples to show cross-repo scenarios

- `CLAUDE.md`
  - Update architecture section
  - Remove references to cache, text search, file operations
  - Update tool count: 9 tools (was 15)
  - Emphasize multi-repo patterns

- `package.json`
  - Description: "MCP server for multi-repository AST-based symbol search and API route discovery"
  - Keywords: Add "multi-repository", "cross-repo", "monorepo", "microservices"
  - Remove keywords: "ripgrep", "full-text-search"

- `CHANGELOG.md`
  ```markdown
  ## [0.2.0] - 2026-01-XX

  ### Breaking Changes
  - Removed text search (use Claude Code's Grep)
  - Removed file operations (use Claude Code's Read/Glob)
  - Removed caching system
  - Removed metadata collection
  - Removed 3 symbol tools (find_enums, find_variables, find_constants)

  ### Improved
  - Repository registration speed: < 1 second (was 5-30s)
  - Codebase size: -40%
  - Package size: -50MB
  - Configuration: 2 env vars (was 8)
  - Focus: Multi-repo AST search only
  ```

**MCP Best Practice Check:**
- ✅ README documents all 9 tools with examples
- ✅ Each tool's purpose is clear
- ✅ Configuration examples are accurate

**Feedback Loop:**
```bash
# Review documentation
cat README.md | head -100
cat docs/MIGRATION.md
cat CHANGELOG.md

git add . && git commit -m "Phase 8: Update documentation"

# Verify markdown formatting
npm run lint  # If configured for markdown
```

**Expected:** Clear documentation explaining multi-repo value, migration guide complete

---

### Phase 9: Update Tests

**Why:** Tests must match new architecture and verify simplified behavior.

**Modify:**
- `src/core/repository-manager.spec.ts`
  - Update Repository type expectations:
    - Remove assertions for `languages`, `fileCount`, `lastScanned`
    - Add assertions for `registeredAt`
  - Update mock data to use new structure
  - Remove any cache-related test assertions

- `src/utils/path-utils.spec.ts`
  - Verify no cache-related tests exist (should be fine)

**Delete:**
- `src/utils/cache.spec.ts` (if exists)
- `src/search/text-search.spec.ts` (if exists)
- `src/search/file-search.spec.ts` (if exists)
- Any tests for removed tools

**Add:**
- Test: Repository registration completes in < 1 second
  ```typescript
  it('should register repository instantly', async () => {
    const start = Date.now()
    await repoManager.register('/path/to/repo')
    const duration = Date.now() - start
    expect(duration).toBeLessThan(1000)
  })
  ```
- Test: No metadata collection during registration
  ```typescript
  it('should not collect languages or file count', async () => {
    const repo = await repoManager.register('/path/to/repo')
    expect(repo.languages).toBeUndefined()
    expect(repo.fileCount).toBeUndefined()
    expect(repo.registeredAt).toBeDefined()
  })
  ```

**MCP Best Practice Check:**
- ✅ Test error handling (errors returned, not thrown)
- ✅ Test response formats match MCP patterns
- ✅ Test type safety maintained

**Feedback Loop:**
```bash
npm test              # All tests pass
npm run test:coverage # Coverage maintained
git add . && git commit -m "Phase 9: Update tests"

# Run specific suites
npm test -- repository-manager.spec.ts
npm test -- path-utils.spec.ts
```

**Expected:** All tests pass, coverage maintained, no references to removed features

---

### Phase 10: Update Package Metadata

**Why:** Version bump and final metadata updates for release.

**Modify:**
- `package.json`
  - Version: `"version": "0.2.0"` (breaking changes)
  - Description: Updated
  - Keywords: Updated
  - Verify dependencies list is clean

**Feedback Loop:**
```bash
npm run build         # Final build
npm run ci            # Full CI suite
npm run lint          # Final lint check
npm test              # Final test run

git add . && git commit -m "Phase 10: Bump version to 0.2.0"

# Create git tag
git tag -a v0.2.0 -m "Version 0.2.0: Focus on multi-repo AST search"

# Verify package contents
npm pack
tar -tzf repo-lens-mcp-0.2.0.tgz | head -30
```

**Expected:** Clean v0.2.0 release ready for publishing

---

## Execution Order with Feedback Loops

Each phase includes verification and commit before proceeding:

1. **Phase 1: Remove caching** → Build & test → Commit ✓
2. **Phase 2: Remove 3 symbol tools** → Verify 3 core tools → Commit ✓
3. **Phase 3: Remove text search** → Verify package size → Commit ✓
4. **Phase 4: Remove file search** → Verify architecture → Commit ✓
5. **Phase 5: Simplify scanner** → **TEST SPEED < 1s** → Commit ✓
6. **Phase 6: Clean dependencies** → Verify deps → Commit ✓
7. **Phase 7: Simplify config** → Test env vars → Commit ✓
8. **Phase 8: Update docs** → Review clarity → Commit ✓
9. **Phase 9: Update tests** → Verify coverage → Commit ✓
10. **Phase 10: Update metadata** → Full CI → Tag v0.2.0 ✓

**Standard feedback after each phase:**
```bash
npm run build && npm test
git add . && git commit -m "Phase X: [description]"
```

**Critical manual tests:**
- After Phase 2: Test find_functions, find_classes, find_types
- After Phase 5: Measure registration speed with large repo
- After Phase 10: Full end-to-end testing

---

## Critical Files to Modify

### Core Implementation
- ✏️ `src/index.ts` - Main entry point, remove engines + cache
- ✏️ `src/tools/repository-tools.ts` - Remove cache, update responses
- ✏️ `src/tools/symbol-tools.ts` - Remove cache, remove 3 tools
- ✏️ `src/tools/api-tools.ts` - Remove cache logic
- ✏️ `src/core/repository-scanner.ts` - Simplify to git-only
- ✏️ `src/core/repository-manager.ts` - Use simplified scanner
- ✏️ `src/types/repository.ts` - Simplify Repository interface
- ✏️ `src/config/types.ts` - Simplify config
- ✏️ `src/config/index.ts` - Simplify loading
- ✏️ `package.json` - Dependencies + metadata

### Files to Delete
- ❌ `src/utils/cache.ts`
- ❌ `src/search/text-search.ts`
- ❌ `src/search/file-search.ts`
- ❌ `src/tools/search-tools.ts`
- ❌ `src/tools/file-tools.ts`

### Documentation
- ✏️ `README.md` - Multi-repo value proposition
- ✏️ `CLAUDE.md` - Updated architecture
- ➕ `docs/MIGRATION.md` - New migration guide
- ✏️ `CHANGELOG.md` - v0.2.0 changes

### Tests
- ✏️ `src/core/repository-manager.spec.ts` - Update expectations
- ✏️ Add registration speed test
- ❌ Remove cache/text/file tests if they exist

---

## Verification Checklist

### Functional Tests
```bash
# Build and start
npm run build
npm run dev

# Test with MCP inspector
npx @modelcontextprotocol/inspector dist/index.js
```

**Test scenarios:**
1. ✅ Register repository (< 1 second)
2. ✅ List repositories (only: id, path, alias, tags, gitInfo, registeredAt)
3. ✅ find_functions across multiple repos
4. ✅ find_classes with name filter
5. ✅ find_types with exportedOnly
6. ✅ find_api_routes with method filter
7. ✅ Unregister repository

### Quality Checks
```bash
npm run ci            # All checks pass
npm run typecheck     # Zero type errors
npm run lint          # Zero lint errors
npm test              # All tests pass
npm run test:coverage # Coverage maintained
```

### MCP Compliance Verification

**Tool count:**
```bash
grep "server.tool(" src/tools/*.ts | wc -l
# Expected: 9 tools
```

**Schema validation:**
```bash
grep -c ".describe(" src/tools/*.ts
# Should be > 0 for all tool files
```

**Error handling:**
```bash
for file in src/tools/*.ts; do
  echo "=== $file ==="
  grep -c "try {" "$file"
  grep -c "isError: true" "$file"
done
# Each should have matching counts
```

**Type safety:**
```bash
npm run typecheck  # ZERO errors
grep -r "\bany\b" src/ --include="*.ts" | grep -v node_modules | wc -l
# Minimize 'any' usage (< 5 occurrences)
```

**Security checks:**
- ✅ Path validation enforced
- ✅ No arbitrary file access
- ✅ Zod validation on all inputs

---

## Expected Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Code size | ~3000 LOC | ~1800 LOC | -40% |
| Registration speed | 5-30 seconds | < 1 second | 10-50× faster |
| Dependencies | 8 packages | 6 packages | -2 |
| Config variables | 8 env vars | 2 env vars | -75% |
| Tools | 15 tools | 9 tools | -6 |
| Package size | ~60MB | ~10MB | -50MB |

**Tool breakdown:**
- Repository: 5 tools (register, unregister, list, get_info, refresh)
- Symbol: 3 tools (find_functions, find_classes, find_types)
- API: 1 tool (find_api_routes)

---

## Success Criteria

- ✅ Repository registration completes in < 1 second
- ✅ No cache-related code remains
- ✅ Text search and file tools removed
- ✅ Only 3 symbol tools remain (functions, classes, types)
- ✅ Documentation clearly explains multi-repo value
- ✅ All tests pass with maintained coverage
- ✅ TypeScript compilation successful (zero errors)
- ✅ Package size reduced by ~50MB
- ✅ All MCP best practices maintained
- ✅ Tool registration patterns consistent
- ✅ Error handling follows standards (no throws, isError flag)
- ✅ Response formats consistent across all tools

---

## Rollback Strategy

Each phase is committed separately for easy rollback:

```bash
# Create feature branch
git checkout -b refactor/focus-on-ast-search

# After each phase
git add .
git commit -m "Phase X: [description]"

# If issues arise
git revert HEAD  # Undo last commit
# or
git checkout main  # Abandon entire refactoring
git branch -D refactor/focus-on-ast-search
```

---

## Post-Release Actions

After successful v0.2.0 release:

1. **Publish to npm:**
   ```bash
   npm publish
   ```

2. **Create GitHub release:**
   - Tag: v0.2.0
   - Include CHANGELOG excerpt
   - Highlight breaking changes

3. **Update examples:**
   - Add multi-repo use case examples
   - Show cross-repo search patterns

4. **Monitor feedback:**
   - GitHub issues for migration problems
   - npm download stats
   - User feedback on multi-repo value

---

## Notes for Implementation

### Key Principles
1. **One phase at a time** - Don't rush, verify each step
2. **Test after every phase** - Catch issues early
3. **Commit frequently** - Easy rollback if needed
4. **Maintain MCP patterns** - Don't break established conventions
5. **Update docs as you go** - Keep documentation in sync

### Common Pitfalls to Avoid
- ❌ Don't remove cache without updating all tool handlers
- ❌ Don't forget to update TypeScript types (Repository interface)
- ❌ Don't break MCP error handling patterns (never throw)
- ❌ Don't skip feedback loops (test after each phase)
- ❌ Don't forget to remove npm packages (check package.json)

### When to Pause
- If any phase fails tests
- If TypeScript errors appear
- If MCP patterns are broken
- If uncertain about a change

**Ask for help before proceeding!**

---

## Questions?

If anything is unclear during implementation:
1. Review CLAUDE.md for architecture details
2. Check existing tool implementations for patterns
3. Run tests frequently to catch issues early
4. Ask for clarification before making risky changes

**Remember:** This is a breaking change (v0.1 → v0.2). Take your time, test thoroughly, and maintain quality standards.

---

*Generated: 2026-01-29*
*Ready for implementation: Yes*
*Breaking changes: Yes (v0.2.0)*
