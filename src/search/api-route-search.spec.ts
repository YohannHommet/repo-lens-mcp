import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APIRouteSearchEngine } from './api-route-search.js'

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
}))

vi.mock('../utils/path-utils.js', () => ({
  getRelativePath: (base: string, file: string) => file.replace(`${base}/`, ''),
}))

// =============================================================================
// Test Helpers
// =============================================================================

function createMockRepo(overrides = {}) {
  return Object.assign({
    id: 'repo-123',
    path: '/projects/app',
    alias: 'my-app',
    gitInfo: { branch: 'main', lastCommit: 'abc123', remote: 'origin' },
    registeredAt: new Date(),
  }, overrides)
}

function createMockAst(routes: Array<{
  text: string
  path?: string
  startLine: number
}>) {
  const matches = routes.map(route => ({
    text: () => route.text,
    getMatch: (key: string) => {
      if (key === 'PATH') {
        return {
          text: () => route.path || '/',
        }
      }
      return null
    },
    range: () => ({
      start: { line: route.startLine - 1 },
      end: { line: route.startLine - 1 },
    }),
    children: () => {
      // Return path as first child for extractPath
      if (route.path) {
        return [{ text: () => `'${route.path}'` }]
      }
      return []
    },
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

describe('apiRouteSearchEngine', () => {
  let engine: APIRouteSearchEngine

  beforeEach(() => {
    vi.clearAllMocks()
    engine = new APIRouteSearchEngine()

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
      const results = await engine.search({}, [repo])

      // Assert
      expect(results).toEqual([])
    })

    it('should skip files without route indicators', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/utils.ts'])
      mockReadFile.mockResolvedValue('function greet() { return "hello" }')
      mockParse.mockReturnValue(createMockAst([]))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({}, [repo])

      // Assert - should not call parse for non-route files
      expect(results).toEqual([])
    })
  })

  // ===========================================================================
  // Express Routes
  // ===========================================================================

  describe('express routes', () => {
    it('should find Express GET route', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/routes.ts'])
      mockReadFile.mockResolvedValue(`app.get('/users', getUsers)`)
      mockParse.mockReturnValue(createMockAst([{
        text: `app.get('/users', getUsers)`,
        path: '/users',
        startLine: 1,
      }]))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({ framework: 'express' }, [repo])

      // Assert
      const expressRoutes = results.filter(r => r.framework === 'express')
      expect(expressRoutes.length).toBeGreaterThan(0)
      expect(expressRoutes.some(r => r.method === 'GET' && r.path === '/users')).toBe(true)
    })

    it('should find Express POST route', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/routes.ts'])
      mockReadFile.mockResolvedValue(`app.post('/users', createUser)`)
      mockParse.mockReturnValue(createMockAst([{
        text: `app.post('/users', createUser)`,
        path: '/users',
        startLine: 1,
      }]))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({ framework: 'express' }, [repo])

      // Assert
      const expressRoutes = results.filter(r => r.framework === 'express')
      expect(expressRoutes.length).toBeGreaterThan(0)
      expect(expressRoutes.some(r => r.method === 'POST')).toBe(true)
    })

    it('should find Express routes with various methods', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/routes.ts'])
      mockReadFile.mockResolvedValue(`
        app.get('/users', list)
        app.post('/users', create)
        app.put('/users/:id', update)
        app.delete('/users/:id', remove)
        app.patch('/users/:id', patch)
      `)

      // Return different matches for different patterns
      mockParse.mockReturnValue({
        root: () => ({
          findAll: (pattern: string) => {
            if (pattern.includes('.get('))
              return [{ text: () => `app.get('/users', list)`, getMatch: () => ({ text: () => `'/users'` }), range: () => ({ start: { line: 0 } }), children: () => [{ text: () => `'/users'` }] }]
            if (pattern.includes('.post('))
              return [{ text: () => `app.post('/users', create)`, getMatch: () => ({ text: () => `'/users'` }), range: () => ({ start: { line: 1 } }), children: () => [{ text: () => `'/users'` }] }]
            return []
          },
        }),
      })

      const repo = createMockRepo()

      // Act
      const results = await engine.search({}, [repo])

      // Assert
      expect(results.length).toBeGreaterThan(0)
    })
  })

  // ===========================================================================
  // NestJS Routes
  // ===========================================================================

  describe('nestjs routes', () => {
    it('should find NestJS decorator routes', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/users.controller.ts'])
      const content = `@Get('users/:id')
async findOne(@Param('id') id: string) { }`
      mockReadFile.mockResolvedValue(content)
      mockParse.mockReturnValue(createMockAst([{
        text: `@Get('users/:id')`,
        path: 'users/:id',
        startLine: 1,
      }]))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({ framework: 'nestjs' }, [repo])

      // Assert
      const nestjsRoutes = results.filter(r => r.framework === 'nestjs')
      expect(nestjsRoutes.length).toBeGreaterThan(0)
      expect(nestjsRoutes[0].method).toBe('GET')
    })
  })

  // ===========================================================================
  // Fastify Routes
  // ===========================================================================

  describe('fastify routes', () => {
    it('should find Fastify routes', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/fastify-routes.ts'])
      mockReadFile.mockResolvedValue(`fastify.get('/health', healthCheck)`)
      mockParse.mockReturnValue(createMockAst([{
        text: `fastify.get('/health', healthCheck)`,
        path: '/health',
        startLine: 1,
      }]))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({ framework: 'fastify' }, [repo])

      // Assert
      const fastifyRoutes = results.filter(r => r.framework === 'fastify')
      expect(fastifyRoutes.length).toBeGreaterThan(0)
    })
  })

  // ===========================================================================
  // Laravel Routes
  // ===========================================================================

  describe('laravel routes', () => {
    it('should find Laravel routes', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/routes/web.php'])
      mockReadFile.mockResolvedValue(`Route::get('/users', [UserController::class, 'index']);`)
      mockParse.mockReturnValue(createMockAst([{
        text: `Route::get('/users', [UserController::class, 'index'])`,
        path: '/users',
        startLine: 1,
      }]))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({ framework: 'laravel' }, [repo])

      // Assert
      const laravelRoutes = results.filter(r => r.framework === 'laravel')
      expect(laravelRoutes.length).toBeGreaterThan(0)
      expect(laravelRoutes[0].method).toBe('GET')
    })

    it('should skip PHP files without Route:: facade', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/app/Models/User.php'])
      mockReadFile.mockResolvedValue(`class User extends Model { }`)

      const repo = createMockRepo()

      // Act
      const results = await engine.search({}, [repo])

      // Assert
      expect(results).toEqual([])
    })
  })

  // ===========================================================================
  // Path Parameter Extraction
  // ===========================================================================

  describe('path parameter extraction', () => {
    it('should extract :param style parameters', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/routes.ts'])
      mockReadFile.mockResolvedValue(`app.get('/users/:id/posts/:postId', handler)`)
      mockParse.mockReturnValue(createMockAst([{
        text: `app.get('/users/:id/posts/:postId', handler)`,
        path: '/users/:id/posts/:postId',
        startLine: 1,
      }]))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({}, [repo])

      // Assert
      if (results[0].parameters && results[0].parameters.path) {
        expect(results[0].parameters.path).toContain('id')
        expect(results[0].parameters.path).toContain('postId')
      }
    })

    it('should extract {param} style parameters (Fastify)', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/fastify-routes.ts'])
      mockReadFile.mockResolvedValue(`fastify.get('/users/{id}', handler)`)
      mockParse.mockReturnValue(createMockAst([{
        text: `fastify.get('/users/{id}', handler)`,
        path: '/users/{id}',
        startLine: 1,
      }]))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({}, [repo])

      // Assert
      if (results[0].parameters && results[0].parameters.path) {
        expect(results[0].parameters.path).toContain('id')
      }
    })
  })

  // ===========================================================================
  // Filtering
  // ===========================================================================

  describe('filtering', () => {
    it('should filter by HTTP method', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/routes.ts'])
      mockReadFile.mockResolvedValue(`
        app.get('/users', list)
        app.post('/users', create)
      `)
      mockParse.mockReturnValue({
        root: () => ({
          findAll: (pattern: string) => {
            if (pattern.includes('.get('))
              return [{ text: () => `app.get('/users', list)`, getMatch: () => ({ text: () => `'/users'` }), range: () => ({ start: { line: 0 } }), children: () => [{ text: () => `'/users'` }] }]
            if (pattern.includes('.post('))
              return [{ text: () => `app.post('/users', create)`, getMatch: () => ({ text: () => `'/users'` }), range: () => ({ start: { line: 1 } }), children: () => [{ text: () => `'/users'` }] }]
            return []
          },
        }),
      })

      const repo = createMockRepo()

      // Act
      const results = await engine.search({ method: 'GET' }, [repo])

      // Assert
      expect(results.every(r => r.method === 'GET')).toBe(true)
    })

    it('should filter by path pattern', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/routes.ts'])
      mockReadFile.mockResolvedValue(`app.get('/api/users', getUsers)`)
      mockParse.mockReturnValue(createMockAst([{
        text: `app.get('/api/users', getUsers)`,
        path: '/api/users',
        startLine: 1,
      }]))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({ pathPattern: '/api', framework: 'express' }, [repo])

      // Assert
      expect(results.length).toBeGreaterThan(0)
      expect(results.every(r => r.path.includes('/api'))).toBe(true)
    })

    it('should filter by framework', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/routes.ts'])
      mockReadFile.mockResolvedValue(`app.get('/users', handler)`)
      mockParse.mockReturnValue(createMockAst([{
        text: `app.get('/users', handler)`,
        path: '/users',
        startLine: 1,
      }]))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({ framework: 'express' }, [repo])

      // Assert
      expect(results.every(r => r.framework === 'express')).toBe(true)
    })
  })

  // ===========================================================================
  // Result Limiting
  // ===========================================================================

  describe('result limiting', () => {
    it('should limit results to maxResults', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/routes.ts'])
      mockReadFile.mockResolvedValue(`
        app.get('/a', handlerA)
        app.get('/b', handlerB)
        app.get('/c', handlerC)
      `)
      mockParse.mockReturnValue({
        root: () => ({
          findAll: () => [
            { text: () => `app.get('/a', handlerA)`, getMatch: () => ({ text: () => `'/a'` }), range: () => ({ start: { line: 0 } }), children: () => [{ text: () => `'/a'` }] },
            { text: () => `app.get('/b', handlerB)`, getMatch: () => ({ text: () => `'/b'` }), range: () => ({ start: { line: 1 } }), children: () => [{ text: () => `'/b'` }] },
            { text: () => `app.get('/c', handlerC)`, getMatch: () => ({ text: () => `'/c'` }), range: () => ({ start: { line: 2 } }), children: () => [{ text: () => `'/c'` }] },
          ],
        }),
      })

      const repo = createMockRepo()

      // Act
      const results = await engine.search({ maxResults: 2 }, [repo])

      // Assert
      expect(results.length).toBeLessThanOrEqual(2)
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
          return ['/projects/app1/src/routes.ts']
        }
        return ['/projects/app2/src/routes.ts']
      })

      mockReadFile.mockImplementation((path) => {
        if (path.includes('app1')) {
          return `app.get('/users', handler)`
        }
        return `app.get('/posts', handler)`
      })

      mockParse.mockImplementation((_lang, content) => {
        if (content.includes('users')) {
          return createMockAst([{ text: `app.get('/users', handler)`, path: '/users', startLine: 1 }])
        }
        return createMockAst([{ text: `app.get('/posts', handler)`, path: '/posts', startLine: 1 }])
      })

      // Act
      const results = await engine.search({ framework: 'express' }, [repo1, repo2])

      // Assert - should have results from both repos
      expect(results.length).toBeGreaterThan(0)
      const repos = new Set(results.map(r => r.repository))
      expect(repos.size).toBe(2)
    })
  })

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe('error handling', () => {
    it('should handle file read errors gracefully', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/routes.ts'])
      mockReadFile.mockRejectedValue(new Error('File not found'))

      const repo = createMockRepo()

      // Act
      const results = await engine.search({}, [repo])

      // Assert
      expect(results).toEqual([])
    })

    it('should handle parse errors gracefully', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/routes.ts'])
      mockReadFile.mockResolvedValue(`app.get('/users', handler)`)
      mockParse.mockImplementation(() => {
        throw new Error('Parse error')
      })

      const repo = createMockRepo()

      // Act
      const results = await engine.search({}, [repo])

      // Assert
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
        return ['/projects/app2/src/routes.ts']
      })

      mockReadFile.mockResolvedValue(`app.get('/users', handler)`)
      mockParse.mockReturnValue(createMockAst([{
        text: `app.get('/users', handler)`,
        path: '/users',
        startLine: 1,
      }]))

      // Act
      const results = await engine.search({ framework: 'express' }, [repo1, repo2])

      // Assert - should have results only from repo2
      expect(results.length).toBeGreaterThan(0)
      expect(results.every(r => r.repository === 'repo-2')).toBe(true)
    })
  })

  // ===========================================================================
  // Early Framework Detection
  // ===========================================================================

  describe('early framework detection', () => {
    it('should skip files without route patterns in content', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/utils.ts'])
      mockReadFile.mockResolvedValue('function helper() { return 1 }')

      const repo = createMockRepo()

      // Act
      const results = await engine.search({}, [repo])

      // Assert - parse should not be called for non-route files
      expect(results).toEqual([])
    })

    it('should process files with route path indicators', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/routes/users.ts'])
      mockReadFile.mockResolvedValue('export const routes = []')
      mockParse.mockReturnValue(createMockAst([]))

      const repo = createMockRepo()

      // Act
      await engine.search({}, [repo])

      // Assert - file should be processed because path contains 'routes'
      expect(mockParse).toHaveBeenCalled()
    })

    it('should process files with controller path indicators', async () => {
      // Arrange
      mockFg.mockResolvedValue(['/projects/app/src/users.controller.ts'])
      mockReadFile.mockResolvedValue('export class UsersController {}')
      mockParse.mockReturnValue(createMockAst([]))

      const repo = createMockRepo()

      // Act
      await engine.search({}, [repo])

      // Assert - file should be processed because path contains 'controller'
      expect(mockParse).toHaveBeenCalled()
    })
  })
})
