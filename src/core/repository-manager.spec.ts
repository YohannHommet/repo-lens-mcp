import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RepositoryManager } from './repository-manager.js'

// =============================================================================
// Mocks
// =============================================================================

const mockSave = vi.fn()
const mockLoad = vi.fn()
const mockScan = vi.fn()
const mockValidatePath = vi.fn()

vi.mock('./config-store.js', () => ({
  ConfigStore: class {
    save = mockSave
    load = mockLoad
  },
}))

vi.mock('./repository-scanner.js', () => ({
  RepositoryScanner: class {
    scan = mockScan
    validatePath = mockValidatePath
  },
}))

vi.mock('../utils/path-utils.js', () => ({
  normalizePath: (p: string) => p,
  isSubPath: (parent: string, child: string) => child.startsWith(`${parent}/`),
}))

// =============================================================================
// Test Suite
// =============================================================================

describe('repositoryManager', () => {
  let manager: RepositoryManager

  // Default git info for mocks
  const defaultGitInfo = { branch: 'main', lastCommit: 'abc123', remote: 'origin' }

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mocks
    mockLoad.mockResolvedValue(new Map())
    mockValidatePath.mockImplementation(async (p: string) => p)
    mockScan.mockResolvedValue({ gitInfo: defaultGitInfo })

    manager = new RepositoryManager('/tmp/config')
  })

  // ===========================================================================
  // register()
  // ===========================================================================

  describe('register', () => {
    it('should register a new repository with default options', async () => {
      // Arrange
      const path = '/projects/my-app'

      // Act
      const result = await manager.register(path)

      // Assert
      expect(result.path).toBe(path)
      expect(result.alias).toBeUndefined()
      expect(result.tags).toEqual([])
      expect(result.gitInfo).toEqual(defaultGitInfo)
      expect(result._action).toBe('registered')
      expect(result.id).toBeDefined()
      expect(result.registeredAt).toBeInstanceOf(Date)
      expect(mockValidatePath).toHaveBeenCalledWith(path)
      expect(mockScan).toHaveBeenCalledWith(path)
      expect(mockSave).toHaveBeenCalledTimes(1)
    })

    it('should register a repository with alias and tags', async () => {
      // Arrange
      const path = '/projects/api'
      const options = { alias: 'backend-api', tags: ['backend', 'typescript'] }

      // Act
      const result = await manager.register(path, options)

      // Assert
      expect(result.alias).toBe('backend-api')
      expect(result.tags).toEqual(['backend', 'typescript'])
    })

    it('should throw error when registering duplicate path', async () => {
      // Arrange
      await manager.register('/projects/app')

      // Act & Assert
      await expect(manager.register('/projects/app'))
        .rejects
        .toThrow('Repository already registered: /projects/app')
    })

    it('should throw error when alias is already in use', async () => {
      // Arrange
      await manager.register('/projects/app1', { alias: 'my-app' })

      // Act & Assert
      await expect(manager.register('/projects/app2', { alias: 'my-app' }))
        .rejects
        .toThrow('Alias already in use: my-app')
    })

    it('should allow same alias on different registration attempts after unregister', async () => {
      // Arrange
      const repo = await manager.register('/projects/app1', { alias: 'my-app' })
      await manager.unregister(repo.id)

      // Act
      const newRepo = await manager.register('/projects/app2', { alias: 'my-app' })

      // Assert
      expect(newRepo.alias).toBe('my-app')
    })
  })

  // ===========================================================================
  // register() with force option
  // ===========================================================================

  describe('register with force', () => {
    it('should update existing repository when force=true', async () => {
      // Arrange
      const original = await manager.register('/projects/app', {
        alias: 'old-alias',
        tags: ['old-tag'],
      })
      const newGitInfo = { branch: 'develop', lastCommit: 'def456', remote: 'origin' }
      mockScan.mockResolvedValueOnce({ gitInfo: newGitInfo })

      // Act
      const updated = await manager.register('/projects/app', {
        alias: 'new-alias',
        tags: ['new-tag'],
        force: true,
      })

      // Assert
      expect(updated.id).toBe(original.id) // Same repository
      expect(updated.alias).toBe('new-alias')
      expect(updated.tags).toEqual(['new-tag'])
      expect(updated.gitInfo).toEqual(newGitInfo)
      expect(updated._action).toBe('updated')
    })

    it('should keep existing alias if not provided in force update', async () => {
      // Arrange
      await manager.register('/projects/app', { alias: 'keep-me' })

      // Act
      const updated = await manager.register('/projects/app', {
        tags: ['updated'],
        force: true,
      })

      // Assert
      expect(updated.alias).toBe('keep-me')
    })

    it('should throw error when force updating with alias already used by another repo', async () => {
      // Arrange
      await manager.register('/projects/app1', { alias: 'taken-alias' })
      await manager.register('/projects/app2', { alias: 'other-alias' })

      // Act & Assert
      await expect(manager.register('/projects/app2', {
        alias: 'taken-alias',
        force: true,
      })).rejects.toThrow('Alias already in use: taken-alias')
    })

    it('should allow keeping same alias on force update', async () => {
      // Arrange
      await manager.register('/projects/app', { alias: 'same-alias' })

      // Act
      const updated = await manager.register('/projects/app', {
        alias: 'same-alias',
        force: true,
      })

      // Assert
      expect(updated.alias).toBe('same-alias')
    })

    it('should throw error when force=false and repo exists', async () => {
      // Arrange
      await manager.register('/projects/app')

      // Act & Assert
      await expect(manager.register('/projects/app', { force: false }))
        .rejects
        .toThrow('Repository already registered')
    })
  })

  // ===========================================================================
  // unregister()
  // ===========================================================================

  describe('unregister', () => {
    it('should remove repository by ID', async () => {
      // Arrange
      const repo = await manager.register('/projects/app')

      // Act
      await manager.unregister(repo.id)

      // Assert
      const list = await manager.list()
      expect(list).toHaveLength(0)
      expect(mockSave).toHaveBeenCalledTimes(2) // register + unregister
    })

    it('should remove repository by alias', async () => {
      // Arrange
      await manager.register('/projects/app', { alias: 'my-app' })

      // Act
      await manager.unregister('my-app')

      // Assert
      const list = await manager.list()
      expect(list).toHaveLength(0)
    })

    it('should remove repository by path', async () => {
      // Arrange
      await manager.register('/projects/app')

      // Act
      await manager.unregister('/projects/app')

      // Assert
      const list = await manager.list()
      expect(list).toHaveLength(0)
    })

    it('should throw error when repository not found', async () => {
      // Act & Assert
      await expect(manager.unregister('non-existent'))
        .rejects
        .toThrow('Repository not found: non-existent')
    })
  })

  // ===========================================================================
  // list()
  // ===========================================================================

  describe('list', () => {
    it('should return empty array when no repositories registered', async () => {
      // Act
      const result = await manager.list()

      // Assert
      expect(result).toEqual([])
    })

    it('should return all repositories when no filter provided', async () => {
      // Arrange
      await manager.register('/projects/app1')
      await manager.register('/projects/app2')
      await manager.register('/projects/app3')

      // Act
      const result = await manager.list()

      // Assert
      expect(result).toHaveLength(3)
    })

    it('should filter repositories by single tag', async () => {
      // Arrange
      await manager.register('/projects/frontend', { tags: ['frontend', 'react'] })
      await manager.register('/projects/backend', { tags: ['backend', 'node'] })
      await manager.register('/projects/shared', { tags: ['shared'] })

      // Act
      const result = await manager.list({ tags: ['frontend'] })

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0].path).toBe('/projects/frontend')
    })

    it('should filter repositories by multiple tags (OR logic)', async () => {
      // Arrange
      await manager.register('/projects/frontend', { tags: ['frontend'] })
      await manager.register('/projects/backend', { tags: ['backend'] })
      await manager.register('/projects/shared', { tags: ['shared'] })

      // Act
      const result = await manager.list({ tags: ['frontend', 'backend'] })

      // Assert
      expect(result).toHaveLength(2)
      const paths = result.map(r => r.path)
      expect(paths).toContain('/projects/frontend')
      expect(paths).toContain('/projects/backend')
    })

    it('should return empty array when no repos match filter', async () => {
      // Arrange
      await manager.register('/projects/app', { tags: ['backend'] })

      // Act
      const result = await manager.list({ tags: ['frontend'] })

      // Assert
      expect(result).toEqual([])
    })

    it('should return all repos when tags filter is empty array', async () => {
      // Arrange
      await manager.register('/projects/app1')
      await manager.register('/projects/app2')

      // Act
      const result = await manager.list({ tags: [] })

      // Assert
      expect(result).toHaveLength(2)
    })
  })

  // ===========================================================================
  // get()
  // ===========================================================================

  describe('get', () => {
    it('should return repository by ID', async () => {
      // Arrange
      const repo = await manager.register('/projects/app')

      // Act
      const result = await manager.get(repo.id)

      // Assert
      expect(result).not.toBeNull()
      expect(result?.id).toBe(repo.id)
    })

    it('should return repository by alias', async () => {
      // Arrange
      await manager.register('/projects/app', { alias: 'my-app' })

      // Act
      const result = await manager.get('my-app')

      // Assert
      expect(result).not.toBeNull()
      expect(result?.alias).toBe('my-app')
    })

    it('should return repository by path', async () => {
      // Arrange
      await manager.register('/projects/app')

      // Act
      const result = await manager.get('/projects/app')

      // Assert
      expect(result).not.toBeNull()
      expect(result?.path).toBe('/projects/app')
    })

    it('should return null when repository not found', async () => {
      // Act
      const result = await manager.get('non-existent')

      // Assert
      expect(result).toBeNull()
    })
  })

  // ===========================================================================
  // resolveIdentifier()
  // ===========================================================================

  describe('resolveIdentifier', () => {
    it('should resolve by ID first', async () => {
      // Arrange
      const repo = await manager.register('/projects/app')

      // Act
      const result = manager.resolveIdentifier(repo.id)

      // Assert
      expect(result?.id).toBe(repo.id)
    })

    it('should resolve by alias when ID not found', async () => {
      // Arrange
      await manager.register('/projects/app', { alias: 'my-alias' })

      // Act
      const result = manager.resolveIdentifier('my-alias')

      // Assert
      expect(result?.alias).toBe('my-alias')
    })

    it('should resolve by path when ID and alias not found', async () => {
      // Arrange
      await manager.register('/projects/app')

      // Act
      const result = manager.resolveIdentifier('/projects/app')

      // Assert
      expect(result?.path).toBe('/projects/app')
    })

    it('should return null when nothing matches', async () => {
      // Arrange
      await manager.register('/projects/app')

      // Act
      const result = manager.resolveIdentifier('does-not-exist')

      // Assert
      expect(result).toBeNull()
    })
  })

  // ===========================================================================
  // resolveIdentifiers()
  // ===========================================================================

  describe('resolveIdentifiers', () => {
    it('should return all repositories when identifiers is undefined', async () => {
      // Arrange
      await manager.register('/projects/app1')
      await manager.register('/projects/app2')

      // Act
      const result = manager.resolveIdentifiers(undefined)

      // Assert
      expect(result).toHaveLength(2)
    })

    it('should return all repositories when identifiers is empty array', async () => {
      // Arrange
      await manager.register('/projects/app1')
      await manager.register('/projects/app2')

      // Act
      const result = manager.resolveIdentifiers([])

      // Assert
      expect(result).toHaveLength(2)
    })

    it('should return only matching repositories', async () => {
      // Arrange
      const repo1 = await manager.register('/projects/app1', { alias: 'app1' })
      await manager.register('/projects/app2', { alias: 'app2' })
      const repo3 = await manager.register('/projects/app3', { alias: 'app3' })

      // Act
      const result = manager.resolveIdentifiers(['app1', 'app3'])

      // Assert
      expect(result).toHaveLength(2)
      const ids = result.map(r => r.id)
      expect(ids).toContain(repo1.id)
      expect(ids).toContain(repo3.id)
    })

    it('should skip non-existent identifiers silently', async () => {
      // Arrange
      await manager.register('/projects/app', { alias: 'existing' })

      // Act
      const result = manager.resolveIdentifiers(['existing', 'non-existent'])

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0].alias).toBe('existing')
    })

    it('should return empty array when no identifiers match', async () => {
      // Arrange
      await manager.register('/projects/app')

      // Act
      const result = manager.resolveIdentifiers(['does-not-exist'])

      // Assert
      expect(result).toEqual([])
    })
  })

  // ===========================================================================
  // resolvePath()
  // ===========================================================================

  describe('resolvePath', () => {
    it('should resolve file path to repository and relative path', async () => {
      // Arrange
      const repo = await manager.register('/projects/app')

      // Act
      const result = manager.resolvePath('/projects/app/src/index.ts')

      // Assert
      expect(result).not.toBeNull()
      expect(result?.repo.id).toBe(repo.id)
      expect(result?.relativePath).toBe('src/index.ts')
    })

    it('should return null when file is not in any repository', async () => {
      // Arrange
      await manager.register('/projects/app')

      // Act
      const result = manager.resolvePath('/other/path/file.ts')

      // Assert
      expect(result).toBeNull()
    })

    it('should match correct repository when multiple repos exist', async () => {
      // Arrange
      await manager.register('/projects/app1')
      const repo2 = await manager.register('/projects/app2')

      // Act
      const result = manager.resolvePath('/projects/app2/src/main.ts')

      // Assert
      expect(result?.repo.id).toBe(repo2.id)
      expect(result?.relativePath).toBe('src/main.ts')
    })

    it('should handle deeply nested file paths', async () => {
      // Arrange
      await manager.register('/projects/app')

      // Act
      const result = manager.resolvePath('/projects/app/src/components/ui/Button/index.tsx')

      // Assert
      expect(result?.relativePath).toBe('src/components/ui/Button/index.tsx')
    })
  })

  // ===========================================================================
  // load()
  // ===========================================================================

  describe('load', () => {
    it('should load repositories from store', async () => {
      // Arrange
      const existingRepos = new Map([
        ['id1', {
          id: 'id1',
          path: '/projects/app1',
          tags: [],
          gitInfo: defaultGitInfo,
          registeredAt: new Date(),
        }],
      ])
      mockLoad.mockResolvedValue(existingRepos)

      // Act
      await manager.load()
      const result = await manager.list()

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('id1')
    })
  })
})
