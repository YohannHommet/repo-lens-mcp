import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SymbolSearchEngine } from './symbol-search.js'

// =============================================================================
// Mocks
// =============================================================================

const mockFg = vi.fn()
const mockReadFile = vi.fn()
const mockParse = vi.fn()

vi.mock('fast-glob', () => ({
  default: (...args: any[]) => mockFg(...args),
}))

vi.mock('node:fs/promises', () => ({
  readFile: (...args: any[]) => mockReadFile(...args),
}))

vi.mock('@ast-grep/napi', () => ({
  parse: (...args: any[]) => mockParse(...args),
  Lang: {
    TypeScript: 'typescript',
    Tsx: 'tsx',
    JavaScript: 'javascript',
    Jsx: 'jsx',
    PHP: 'php',
  },
}))

vi.mock('../utils/path-utils.js', () => ({
  getRelativePath: (base: string, file: string) => file.replace(`${base}/`, ''),
}))

// =============================================================================
// Test Helpers
// =============================================================================

function createMockRepo(overrides = {}) {
  return {
    id: 'repo-123',
    path: '/projects/app',
    alias: 'my-app',
    gitInfo: { branch: 'main', lastCommit: 'abc123', remote: 'origin' },
    registeredAt: new Date(),
    ...overrides,
  }
}

function createMockAst(symbols: Array<{
  name: string
  kind: string
  startLine: number
  endLine: number
  text: string
  isExported?: boolean
  nodeKind?: string
}>) {
  const matches = symbols.map(sym => ({
    getMatch: (key: string) => key === 'NAME' ? { text: () => sym.name } : null,
    range: () => ({
      start: { line: sym.startLine - 1, index: 0 },
      end: { line: sym.endLine - 1, index: 100 },
    }),
    text: () => sym.text,
    kind: () => sym.nodeKind ?? (sym.isExported ? 'export_statement' : 'function_declaration'),
    parent: () => sym.isExported
      ? { kind: () => 'export_statement', parent: () => null }
      : { kind: () => 'program', parent: () => null },
    // Support child-based name extraction for rule-based patterns (PHP)
    children: () => [
      { kind: () => 'name', text: () => sym.name, children: () => [] },
      // For const_declaration, also provide const_element child
      { kind: () => 'const_element', text: () => `${sym.name} = ...`, children: () => [
        { kind: () => 'name', text: () => sym.name, children: () => [] },
      ] },
    ],
  }))

  return {
    root: () => ({
      findAll: () => matches,
    }),
  }
}

// =============================================================================
// Test Suite
// =============================================================================

describe('symbolSearchEngine', () => {
  let engine: SymbolSearchEngine

  beforeEach(() => {
    vi.clearAllMocks()
    engine = new SymbolSearchEngine()

    // Default mocks
    mockFg.mockResolvedValue([])
    mockReadFile.mockResolvedValue('')
    mockParse.mockReturnValue(createMockAst([]))
  })

  // ===========================================================================
  // Basic Search
  // ===========================================================================

  describe('search', () => {
    it('should return empty array when no files found', async () => {
      // Arrange
      mockFg.mockResolvedValue([])
      const repo = createMockRepo()

      // Act
      const results = await engine.search({ kind: 'function' }, [repo])

      // Assert
      expect(results).toEqual([])
    })

    it('should find functions in TypeScript files', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/utils.ts'])
      mockReadFile.mockResolvedValue('export function greet(name: string) { return "Hello " + name }')
      mockParse.mockReturnValue(createMockAst([{
        name: 'greet',
        kind: 'function',
        startLine: 1,
        endLine: 1,
        text: 'export function greet(name: string) { return "Hello " + name }',
        isExported: true,
      }]))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({ kind: 'function' }, [repo])

      // Assert
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('greet')
      expect(results[0].kind).toBe('function')
      expect(results[0].exported).toBe(true)
      expect(results[0].repository).toBe('repo-123')
      expect(results[0].repositoryAlias).toBe('my-app')
    })

    it('should find classes', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/user.ts'])
      mockReadFile.mockResolvedValue('export class User { name: string }')
      mockParse.mockReturnValue(createMockAst([{
        name: 'User',
        kind: 'class',
        startLine: 1,
        endLine: 1,
        text: 'export class User { name: string }',
        isExported: true,
      }]))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({ kind: 'class' }, [repo])

      // Assert
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('User')
      expect(results[0].kind).toBe('class')
    })

    it('should find interfaces', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/types.ts'])
      mockReadFile.mockResolvedValue('export interface UserProps { name: string }')
      mockParse.mockReturnValue(createMockAst([{
        name: 'UserProps',
        kind: 'interface',
        startLine: 1,
        endLine: 1,
        text: 'export interface UserProps { name: string }',
        isExported: true,
      }]))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({ kind: 'interface' }, [repo])

      // Assert
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('UserProps')
      expect(results[0].kind).toBe('interface')
    })

    it('should find type aliases', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/types.ts'])
      mockReadFile.mockResolvedValue('export type ID = string | number')
      mockParse.mockReturnValue(createMockAst([{
        name: 'ID',
        kind: 'type',
        startLine: 1,
        endLine: 1,
        text: 'export type ID = string | number',
        isExported: true,
      }]))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({ kind: 'type' }, [repo])

      // Assert
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('ID')
      expect(results[0].kind).toBe('type')
    })
  })

  // ===========================================================================
  // Name Pattern Matching
  // ===========================================================================

  describe('name pattern matching', () => {
    it('should filter by exact name pattern', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/utils.ts'])
      mockReadFile.mockResolvedValue('function foo() {} function bar() {}')
      mockParse.mockReturnValue(createMockAst([
        { name: 'foo', kind: 'function', startLine: 1, endLine: 1, text: 'function foo() {}' },
        { name: 'bar', kind: 'function', startLine: 1, endLine: 1, text: 'function bar() {}' },
      ]))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({ kind: 'function', name: 'foo' }, [repo])

      // Assert
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('foo')
    })

    it('should support wildcard pattern matching', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/handlers.ts'])
      mockReadFile.mockResolvedValue('function handleClick() {} function handleSubmit() {} function process() {}')
      mockParse.mockReturnValue(createMockAst([
        { name: 'handleClick', kind: 'function', startLine: 1, endLine: 1, text: 'function handleClick() {}' },
        { name: 'handleSubmit', kind: 'function', startLine: 2, endLine: 2, text: 'function handleSubmit() {}' },
        { name: 'process', kind: 'function', startLine: 3, endLine: 3, text: 'function process() {}' },
      ]))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({ kind: 'function', name: 'handle*' }, [repo])

      // Assert
      expect(results).toHaveLength(2)
      expect(results.map(r => r.name)).toContain('handleClick')
      expect(results.map(r => r.name)).toContain('handleSubmit')
    })

    it('should support case-insensitive substring matching', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/utils.ts'])
      mockReadFile.mockResolvedValue('function getUserById() {}')
      mockParse.mockReturnValue(createMockAst([
        { name: 'getUserById', kind: 'function', startLine: 1, endLine: 1, text: 'function getUserById() {}' },
      ]))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({ kind: 'function', name: 'user' }, [repo])

      // Assert
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('getUserById')
    })
  })

  // ===========================================================================
  // Export Detection
  // ===========================================================================

  describe('export detection', () => {
    it('should detect inline exports', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/utils.ts'])
      mockReadFile.mockResolvedValue('export function greet() {}')
      mockParse.mockReturnValue(createMockAst([{
        name: 'greet',
        kind: 'function',
        startLine: 1,
        endLine: 1,
        text: 'export function greet() {}',
        isExported: true,
      }]))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({ kind: 'function' }, [repo])

      // Assert
      expect(results[0].exported).toBe(true)
    })

    it('should detect named exports', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/utils.ts'])
      const content = `function greet() {}
export { greet }`
      mockReadFile.mockResolvedValue(content)
      mockParse.mockReturnValue(createMockAst([{
        name: 'greet',
        kind: 'function',
        startLine: 1,
        endLine: 1,
        text: 'function greet() {}',
        isExported: false,
      }]))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({ kind: 'function' }, [repo])

      // Assert
      expect(results[0].exported).toBe(true)
    })

    it('should detect default exports', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/utils.ts'])
      const content = `function greet() {}
export default greet`
      mockReadFile.mockResolvedValue(content)
      mockParse.mockReturnValue(createMockAst([{
        name: 'greet',
        kind: 'function',
        startLine: 1,
        endLine: 1,
        text: 'function greet() {}',
        isExported: false,
      }]))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({ kind: 'function' }, [repo])

      // Assert
      expect(results[0].exported).toBe(true)
    })

    it('should filter by exportedOnly', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/utils.ts'])
      mockReadFile.mockResolvedValue('function internal() {} export function external() {}')
      mockParse.mockReturnValue(createMockAst([
        { name: 'internal', kind: 'function', startLine: 1, endLine: 1, text: 'function internal() {}', isExported: false },
        { name: 'external', kind: 'function', startLine: 1, endLine: 1, text: 'export function external() {}', isExported: true },
      ]))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({ kind: 'function', exportedOnly: true }, [repo])

      // Assert
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('external')
    })
  })

  // ===========================================================================
  // Language Filtering
  // ===========================================================================

  describe('language filtering', () => {
    it('should filter by TypeScript', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/utils.ts'])
      mockReadFile.mockResolvedValue('function greet() {}')
      mockParse.mockReturnValue(createMockAst([{
        name: 'greet',
        kind: 'function',
        startLine: 1,
        endLine: 1,
        text: 'function greet() {}',
      }]))

      const repo = createMockRepo()

      // Act
      await engine.search({ kind: 'function', language: 'typescript' }, [repo])

      // Assert
      expect(mockFg).toHaveBeenCalledWith(
        expect.arrayContaining(['**/*.ts', '**/*.tsx']),
        expect.any(Object),
      )
    })

    it('should filter by JavaScript', async () => {
      // Arrange
      mockFg.mockResolvedValue([])
      const repo = createMockRepo()

      // Act
      await engine.search({ kind: 'function', language: 'javascript' }, [repo])

      // Assert
      expect(mockFg).toHaveBeenCalledWith(
        expect.arrayContaining(['**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs']),
        expect.any(Object),
      )
    })
  })

  // ===========================================================================
  // Result Limiting
  // ===========================================================================

  describe('result limiting', () => {
    it('should limit results to maxResults', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/utils.ts'])
      mockReadFile.mockResolvedValue('function a() {} function b() {} function c() {}')
      mockParse.mockReturnValue(createMockAst([
        { name: 'a', kind: 'function', startLine: 1, endLine: 1, text: 'function a() {}' },
        { name: 'b', kind: 'function', startLine: 2, endLine: 2, text: 'function b() {}' },
        { name: 'c', kind: 'function', startLine: 3, endLine: 3, text: 'function c() {}' },
      ]))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({ kind: 'function', maxResults: 2 }, [repo])

      // Assert
      expect(results).toHaveLength(2)
    })

    it('should use default maxResults of 100', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/utils.ts'])
      mockReadFile.mockResolvedValue('')
      mockParse.mockReturnValue(createMockAst([]))

      const repo = createMockRepo()

      // Act - no maxResults specified
      await engine.search({ kind: 'function' }, [repo])

      // Assert - should not throw
      expect(mockFg).toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // Multi-Repository Search
  // ===========================================================================

  describe('multi-repository search', () => {
    it('should search across multiple repositories', async () => {
      // Arrange
      const repo1 = createMockRepo({ id: 'repo-1', path: '/projects/app1', alias: 'app1' })
      const repo2 = createMockRepo({ id: 'repo-2', path: '/projects/app2', alias: 'app2' })

      mockFg.mockImplementation((_patterns, options) => {
        if (options.cwd === '/projects/app1') {
          return ['/projects/app1/src/a.ts']
        }
        return ['/projects/app2/src/b.ts']
      })

      mockReadFile.mockImplementation((path) => {
        if (path.includes('app1')) {
          return 'function funcA() {}'
        }
        return 'function funcB() {}'
      })

      mockParse.mockImplementation((_lang, content) => {
        if (content.includes('funcA')) {
          return createMockAst([{
            name: 'funcA',
            kind: 'function',
            startLine: 1,
            endLine: 1,
            text: 'function funcA() {}',
          }])
        }
        return createMockAst([{
          name: 'funcB',
          kind: 'function',
          startLine: 1,
          endLine: 1,
          text: 'function funcB() {}',
        }])
      })

      // Act
      const results = await engine.search({ kind: 'function' }, [repo1, repo2])

      // Assert
      expect(results).toHaveLength(2)
      expect(results.map(r => r.name)).toContain('funcA')
      expect(results.map(r => r.name)).toContain('funcB')
    })

    it('should distribute maxResults across repositories', async () => {
      // Arrange
      const repo1 = createMockRepo({ id: 'repo-1', path: '/projects/app1' })
      const repo2 = createMockRepo({ id: 'repo-2', path: '/projects/app2' })

      mockFg.mockResolvedValue([])

      // Act
      await engine.search({ kind: 'function', maxResults: 10 }, [repo1, repo2])

      // Assert - each repo should get ceil(10/2) = 5 max results
      expect(mockFg).toHaveBeenCalledTimes(2)
    })
  })

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe('error handling', () => {
    it('should handle file read errors gracefully', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/broken.ts'])
      mockReadFile.mockRejectedValue(new Error('File not found'))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({ kind: 'function' }, [repo])

      // Assert - should return empty array, not throw
      expect(results).toEqual([])
    })

    it('should handle parse errors gracefully', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/invalid.ts'])
      mockReadFile.mockResolvedValue('this is not valid typescript {{{{')
      mockParse.mockImplementation(() => {
        throw new Error('Parse error')
      })

      const repo = createMockRepo()

      // Act
      const results = await engine.search({ kind: 'function' }, [repo])

      // Assert - should return empty array, not throw
      expect(results).toEqual([])
    })

    it('should continue searching other repos on error', async () => {
      // Arrange
      const repo1 = createMockRepo({ id: 'repo-1', path: '/projects/app1' })
      const repo2 = createMockRepo({ id: 'repo-2', path: '/projects/app2' })

      mockFg.mockImplementation((_patterns, options) => {
        if (options.cwd === '/projects/app1') {
          throw new Error('Permission denied')
        }
        return ['/projects/app2/src/file.ts']
      })

      mockReadFile.mockResolvedValue('function greet() {}')
      mockParse.mockReturnValue(createMockAst([{
        name: 'greet',
        kind: 'function',
        startLine: 1,
        endLine: 1,
        text: 'function greet() {}',
      }]))

      // Act
      const results = await engine.search({ kind: 'function' }, [repo1, repo2])

      // Assert - should have results from repo2
      expect(results).toHaveLength(1)
      expect(results[0].repository).toBe('repo-2')
    })
  })

  // ===========================================================================
  // Content Pre-Filtering
  // ===========================================================================

  describe('content pre-filtering', () => {
    it('should skip AST parsing when file content does not contain the searched name', async () => {
      const repo = createMockRepo()
      mockFg.mockResolvedValue(['/projects/app/src/unrelated.ts'])
      mockReadFile.mockResolvedValue('export function unrelatedHelper() { return true }')

      const engine = new SymbolSearchEngine()
      const results = await engine.search(
        { kind: 'function', name: 'parseUserData', maxResults: 100 },
        [repo],
      )

      expect(results).toEqual([])
      expect(mockParse).not.toHaveBeenCalled()
    })

    it('should still parse when file content contains the searched name', async () => {
      const repo = createMockRepo()
      mockFg.mockResolvedValue(['/projects/app/src/user.ts'])
      mockReadFile.mockResolvedValue('export function parseUserData(data: unknown) { return data }')
      mockParse.mockReturnValue(createMockAst([
        { name: 'parseUserData', kind: 'function', startLine: 1, endLine: 1, text: 'export function parseUserData(data: unknown) { return data }', isExported: true },
      ]))

      const engine = new SymbolSearchEngine()
      const results = await engine.search(
        { kind: 'function', name: 'parseUserData', maxResults: 100 },
        [repo],
      )

      expect(results).toHaveLength(1)
      expect(mockParse).toHaveBeenCalled()
    })

    it('should skip pre-filter for wildcard patterns', async () => {
      const repo = createMockRepo()
      mockFg.mockResolvedValue(['/projects/app/src/file.ts'])
      mockReadFile.mockResolvedValue('export function something() {}')
      mockParse.mockReturnValue(createMockAst([
        { name: 'something', kind: 'function', startLine: 1, endLine: 1, text: 'export function something() {}', isExported: true },
      ]))

      const engine = new SymbolSearchEngine()
      await engine.search(
        { kind: 'function', name: 'some*', maxResults: 100 },
        [repo],
      )

      expect(mockParse).toHaveBeenCalled()
    })

    it('should not pre-filter when no name is specified', async () => {
      const repo = createMockRepo()
      mockFg.mockResolvedValue(['/projects/app/src/file.ts'])
      mockReadFile.mockResolvedValue('export function anything() {}')
      mockParse.mockReturnValue(createMockAst([
        { name: 'anything', kind: 'function', startLine: 1, endLine: 1, text: 'export function anything() {}', isExported: true },
      ]))

      const engine = new SymbolSearchEngine()
      await engine.search(
        { kind: 'function', maxResults: 100 },
        [repo],
      )

      expect(mockParse).toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // Multi-Kind Search
  // ===========================================================================

  describe('multi-kind search', () => {
    it('should search for multiple kinds in a single pass', async () => {
      const repo = createMockRepo()
      mockFg.mockResolvedValue(['/projects/app/src/types.ts'])
      mockReadFile.mockResolvedValue('export type UserId = string\nexport interface User { id: UserId }')

      const typeMatch = {
        getMatch: (key: string) => key === 'NAME' ? { text: () => 'UserId' } : null,
        range: () => ({ start: { line: 0, index: 0 }, end: { line: 0, index: 100 } }),
        text: () => 'export type UserId = string',
        kind: () => 'export_statement',
        parent: () => ({ kind: () => 'export_statement', parent: () => null }),
      }
      const interfaceMatch = {
        getMatch: (key: string) => key === 'NAME' ? { text: () => 'User' } : null,
        range: () => ({ start: { line: 1, index: 0 }, end: { line: 1, index: 100 } }),
        text: () => 'export interface User { id: UserId }',
        kind: () => 'export_statement',
        parent: () => ({ kind: () => 'export_statement', parent: () => null }),
      }

      mockParse.mockReturnValue({
        root: () => ({
          findAll: (pattern: string) => {
            if (pattern.includes('type'))
              return [typeMatch]
            if (pattern.includes('interface'))
              return [interfaceMatch]
            return []
          },
        }),
      })

      const engine = new SymbolSearchEngine()
      const results = await engine.search(
        { kinds: ['type', 'interface'], maxResults: 100 },
        [repo],
      )

      expect(results).toHaveLength(2)
      expect(results.map(r => r.kind)).toContain('type')
      expect(results.map(r => r.kind)).toContain('interface')
      expect(mockReadFile).toHaveBeenCalledTimes(1)
      expect(mockParse).toHaveBeenCalledTimes(1)
    })
  })

  // ===========================================================================
  // Signature Extraction
  // ===========================================================================

  describe('signature extraction', () => {
    it('should extract function signature', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/utils.ts'])
      mockReadFile.mockResolvedValue('function greet(name: string): string { return name }')
      mockParse.mockReturnValue(createMockAst([{
        name: 'greet',
        kind: 'function',
        startLine: 1,
        endLine: 1,
        text: 'function greet(name: string): string { return name }',
      }]))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({ kind: 'function' }, [repo])

      // Assert
      expect(results[0].signature).toContain('greet(name: string)')
    })

    it('should extract class signature', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/user.ts'])
      mockReadFile.mockResolvedValue('export class User extends Base { }')
      mockParse.mockReturnValue(createMockAst([{
        name: 'User',
        kind: 'class',
        startLine: 1,
        endLine: 1,
        text: 'export class User extends Base { }',
        isExported: true,
      }]))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({ kind: 'class' }, [repo])

      // Assert
      expect(results[0].signature).toContain('class User extends Base')
    })
  })

  // ===========================================================================
  // PHP Symbol Search
  // ===========================================================================

  describe('PHP symbol search', () => {
    it('should find PHP functions', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/helpers.php'])
      mockReadFile.mockResolvedValue('<?php\nfunction createUser($data) { return $data; }')
      mockParse.mockReturnValue(createMockAst([{
        name: 'createUser',
        kind: 'function',
        startLine: 2,
        endLine: 2,
        text: 'function createUser($data) { return $data; }',
        nodeKind: 'function_definition',
      }]))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({ kind: 'function' }, [repo])

      // Assert
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('createUser')
      expect(results[0].kind).toBe('function')
    })

    it('should find PHP classes', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/UserController.php'])
      mockReadFile.mockResolvedValue('<?php\nclass UserController extends Controller { }')
      mockParse.mockReturnValue(createMockAst([{
        name: 'UserController',
        kind: 'class',
        startLine: 2,
        endLine: 2,
        text: 'class UserController extends Controller { }',
        nodeKind: 'class_declaration',
      }]))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({ kind: 'class' }, [repo])

      // Assert
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('UserController')
      expect(results[0].kind).toBe('class')
    })

    it('should find PHP traits (mapped to class kind)', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/HasTimestamps.php'])
      mockReadFile.mockResolvedValue('<?php\ntrait HasTimestamps { }')
      mockParse.mockReturnValue(createMockAst([{
        name: 'HasTimestamps',
        kind: 'class',
        startLine: 2,
        endLine: 2,
        text: 'trait HasTimestamps { }',
        nodeKind: 'trait_declaration',
      }]))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({ kind: 'class' }, [repo])

      // Assert
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('HasTimestamps')
      expect(results[0].kind).toBe('class')
    })

    it('should find PHP interfaces', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/UserRepository.php'])
      mockReadFile.mockResolvedValue('<?php\ninterface UserRepositoryInterface { }')
      mockParse.mockReturnValue(createMockAst([{
        name: 'UserRepositoryInterface',
        kind: 'interface',
        startLine: 2,
        endLine: 2,
        text: 'interface UserRepositoryInterface { }',
        nodeKind: 'interface_declaration',
      }]))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({ kind: 'interface' }, [repo])

      // Assert
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('UserRepositoryInterface')
      expect(results[0].kind).toBe('interface')
    })

    it('should find PHP enums', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/Status.php'])
      mockReadFile.mockResolvedValue('<?php\nenum Status: string { case Active = "active"; }')
      mockParse.mockReturnValue(createMockAst([{
        name: 'Status',
        kind: 'enum',
        startLine: 2,
        endLine: 2,
        text: 'enum Status: string { case Active = "active"; }',
        nodeKind: 'enum_declaration',
      }]))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({ kind: 'enum' }, [repo])

      // Assert
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('Status')
      expect(results[0].kind).toBe('enum')
    })

    it('should mark namespace-level PHP function as exported', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/helpers.php'])
      mockReadFile.mockResolvedValue('<?php\nfunction bar() { }')
      mockParse.mockReturnValue(createMockAst([{
        name: 'bar',
        kind: 'function',
        startLine: 2,
        endLine: 2,
        text: 'function bar() { }',
        nodeKind: 'function_definition',
      }]))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({ kind: 'function' }, [repo])

      // Assert
      expect(results).toHaveLength(1)
      expect(results[0].exported).toBe(true)
    })

    it('should mark private PHP method as not exported', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/Service.php'])
      mockReadFile.mockResolvedValue('<?php\nprivate function secret() { }')
      mockParse.mockReturnValue(createMockAst([{
        name: 'secret',
        kind: 'function',
        startLine: 2,
        endLine: 2,
        text: 'private function secret() { }',
        nodeKind: 'method_declaration',
      }]))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({ kind: 'function' }, [repo])

      // Assert
      expect(results).toHaveLength(1)
      expect(results[0].exported).toBe(false)
    })

    it('should use *.php glob when language filter is php', async () => {
      // Arrange
      mockFg.mockResolvedValue([])
      const repo = createMockRepo()

      // Act
      await engine.search({ kind: 'function', language: 'php' }, [repo])

      // Assert
      expect(mockFg).toHaveBeenCalledWith(
        ['**/*.php'],
        expect.any(Object),
      )
    })
  })
})
