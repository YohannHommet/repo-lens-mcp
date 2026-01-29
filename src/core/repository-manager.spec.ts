import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RepositoryManager } from './repository-manager.js'

// Mocks
const mockSave = vi.fn()
const mockLoad = vi.fn()
const mockScan = vi.fn()
const mockValidatePath = vi.fn()

vi.mock('./config-store.js', () => {
  return {
    ConfigStore: class {
      save = mockSave
      load = mockLoad
    },
  }
})

vi.mock('./repository-scanner.js', () => {
  return {
    RepositoryScanner: class {
      scan = mockScan
      validatePath = mockValidatePath
    },
  }
})

describe('repositoryManager', () => {
  let repoManager: RepositoryManager

  beforeEach(() => {
    vi.clearAllMocks()
    // Setup default mocks
    mockLoad.mockResolvedValue(new Map())
    mockValidatePath.mockImplementation(async p => p) // Return path as is
    mockScan.mockResolvedValue({
      gitInfo: { branch: 'main', lastCommit: 'abc', remote: 'origin' },
    })

    repoManager = new RepositoryManager('/tmp/config')
  })

  describe('register', () => {
    it('should register a new repository', async () => {
      const repo = await repoManager.register('/path/to/repo')

      expect(mockValidatePath).toHaveBeenCalledWith('/path/to/repo')
      expect(mockScan).toHaveBeenCalledWith('/path/to/repo')
      expect(mockSave).toHaveBeenCalled()
      expect(repo.path).toBe('/path/to/repo')

      const list = await repoManager.list()
      expect(list).toHaveLength(1)
      expect(list[0].id).toBe(repo.id)
    })

    it('should throw if repo already registered', async () => {
      await repoManager.register('/path/to/repo')

      await expect(repoManager.register('/path/to/repo'))
        .rejects
        .toThrow('Repository already registered')
    })

    it('should enforce unique alias', async () => {
      await repoManager.register('/repo1', { alias: 'my-repo' })

      await expect(repoManager.register('/repo2', { alias: 'my-repo' }))
        .rejects
        .toThrow('Alias already in use')
    })
  })

  describe('unregister', () => {
    it('should remove repository', async () => {
      const repo = await repoManager.register('/repo1')
      expect((await repoManager.list())).toHaveLength(1)

      await repoManager.unregister(repo.id)

      expect((await repoManager.list())).toHaveLength(0)
      expect(mockSave).toHaveBeenCalledTimes(2) // 1 register + 1 unregister
    })

    it('should throw if repo not found', async () => {
      await expect(repoManager.unregister('unknown-id'))
        .rejects
        .toThrow('Repository not found')
    })
  })

  describe('register with force', () => {
    it('should update existing repo when force=true', async () => {
      const repo = await repoManager.register('/repo1', { alias: 'old-alias' })

      // Change scan result for the update
      mockScan.mockResolvedValueOnce({
        gitInfo: { branch: 'develop', lastCommit: 'def', remote: 'origin' },
      })

      const updated = await repoManager.register('/repo1', {
        alias: 'new-alias',
        tags: ['updated'],
        force: true,
      })

      expect(updated.id).toBe(repo.id) // Same repo
      expect(updated.alias).toBe('new-alias')
      expect(updated.tags).toEqual(['updated'])
      expect(updated.gitInfo.branch).toBe('develop')
      expect(mockSave).toHaveBeenCalledTimes(2) // 1 register + 1 update
    })

    it('should throw if force=false and repo exists', async () => {
      await repoManager.register('/repo1')

      await expect(repoManager.register('/repo1', { force: false }))
        .rejects
        .toThrow('Repository already registered')
    })
  })
})
