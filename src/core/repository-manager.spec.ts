import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RepositoryManager } from './repository-manager.js'

// =============================================================================
// Mocks
// =============================================================================

const mockLoad = vi.fn()
const mockScan = vi.fn()
const mockValidatePath = vi.fn()

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

  const defaultGitInfo = { branch: 'main', lastCommit: 'abc123', remote: 'origin' }

  beforeEach(() => {
    vi.clearAllMocks()

    mockLoad.mockResolvedValue([])
    mockValidatePath.mockImplementation(async (p: string) => p)
    mockScan.mockResolvedValue({ gitInfo: defaultGitInfo })

    manager = new RepositoryManager({ load: mockLoad } as any)
  })

  // ===========================================================================
  // list()
  // ===========================================================================

  describe('list', () => {
    it('should return empty array when no repos', () => {
      expect(manager.list()).toEqual([])
    })

    it('should return all repos after load', async () => {
      mockLoad.mockResolvedValue([
        { path: '/projects/app1', alias: 'app1' },
        { path: '/projects/app2' },
        { path: '/projects/app3' },
      ])

      await manager.load()
      const result = manager.list()

      expect(result).toHaveLength(3)
    })
  })

  // ===========================================================================
  // get() / resolveIdentifier()
  // ===========================================================================

  describe('get / resolveIdentifier', () => {
    it('should resolve by path', async () => {
      mockLoad.mockResolvedValue([{ path: '/projects/app1' }])
      await manager.load()

      const result = manager.get('/projects/app1')

      expect(result).not.toBeNull()
      expect(result!.path).toBe('/projects/app1')
    })

    it('should resolve by alias', async () => {
      mockLoad.mockResolvedValue([{ path: '/projects/app1', alias: 'my-app' }])
      await manager.load()

      const result = manager.get('my-app')

      expect(result).not.toBeNull()
      expect(result!.alias).toBe('my-app')
    })

    it('should return null when not found', () => {
      const result = manager.get('non-existent')

      expect(result).toBeNull()
    })
  })

  // ===========================================================================
  // resolveIdentifiers()
  // ===========================================================================

  describe('resolveIdentifiers', () => {
    it('should return all when undefined', async () => {
      mockLoad.mockResolvedValue([
        { path: '/projects/app1' },
        { path: '/projects/app2' },
      ])
      await manager.load()

      const result = manager.resolveIdentifiers(undefined)

      expect(result).toHaveLength(2)
    })

    it('should return all when empty array', async () => {
      mockLoad.mockResolvedValue([
        { path: '/projects/app1' },
        { path: '/projects/app2' },
      ])
      await manager.load()

      const result = manager.resolveIdentifiers([])

      expect(result).toHaveLength(2)
    })

    it('should return matching repos', async () => {
      mockLoad.mockResolvedValue([
        { path: '/projects/app1', alias: 'app1' },
        { path: '/projects/app2', alias: 'app2' },
        { path: '/projects/app3', alias: 'app3' },
      ])
      await manager.load()

      const result = manager.resolveIdentifiers(['app1', 'app3'])

      expect(result).toHaveLength(2)
      const paths = result.map(r => r.path)
      expect(paths).toContain('/projects/app1')
      expect(paths).toContain('/projects/app3')
    })

    it('should skip non-existent silently', async () => {
      mockLoad.mockResolvedValue([
        { path: '/projects/app1', alias: 'existing' },
      ])
      await manager.load()

      const result = manager.resolveIdentifiers(['existing', 'non-existent'])

      expect(result).toHaveLength(1)
      expect(result[0].alias).toBe('existing')
    })
  })

  // ===========================================================================
  // createAdHocRepositories()
  // ===========================================================================

  describe('createAdHocRepositories', () => {
    it('should create lightweight repos from paths', () => {
      const repos = manager.createAdHocRepositories(['/projects/app1', '/projects/app2'])

      expect(repos).toHaveLength(2)
      expect(repos[0].id).toBe('/projects/app1')
      expect(repos[0].path).toBe('/projects/app1')
      expect(repos[1].id).toBe('/projects/app2')
      expect(repos[1].path).toBe('/projects/app2')
    })

    it('should use directory name as alias', () => {
      const repos = manager.createAdHocRepositories(['/projects/my-app'])

      expect(repos[0].alias).toBe('my-app')
    })

    it('should set gitInfo to unknown', () => {
      const repos = manager.createAdHocRepositories(['/projects/app1'])

      expect(repos[0].gitInfo.branch).toBe('unknown')
      expect(repos[0].gitInfo.lastCommit).toBe('unknown')
    })
  })

  // ===========================================================================
  // load()
  // ===========================================================================

  describe('load', () => {
    it('should load repos from config entries', async () => {
      mockLoad.mockResolvedValue([
        { path: '/projects/app1', alias: 'app1' },
        { path: '/projects/app2' },
      ])

      await manager.load()
      const result = manager.list()

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('/projects/app1')
      expect(result[0].alias).toBe('app1')
      expect(result[0].gitInfo).toEqual(defaultGitInfo)
      expect(result[1].id).toBe('/projects/app2')
      expect(result[1].alias).toBeUndefined()
    })

    it('should skip invalid repos gracefully', async () => {
      mockLoad.mockResolvedValue([
        { path: '/projects/valid', alias: 'valid' },
        { path: '/projects/broken' },
      ])
      mockValidatePath
        .mockResolvedValueOnce('/projects/valid')
        .mockRejectedValueOnce(new Error('Not a git repo'))

      await manager.load()
      const result = manager.list()

      expect(result).toHaveLength(1)
      expect(result[0].path).toBe('/projects/valid')
    })
  })
})
