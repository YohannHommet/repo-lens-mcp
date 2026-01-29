import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConfigStore } from './config-store.js'

// =============================================================================
// Mocks
// =============================================================================

const mockExistsSync = vi.fn()
const mockReadFile = vi.fn()
const mockWriteFile = vi.fn()
const mockMkdir = vi.fn()
const mockChmod = vi.fn()

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
}))

vi.mock('node:fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  chmod: (...args: unknown[]) => mockChmod(...args),
}))

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

// =============================================================================
// Test Suite
// =============================================================================

describe('configStore', () => {
  let store: ConfigStore

  const sampleRepoConfig = {
    version: 1,
    repositories: [
      {
        id: 'repo-1',
        path: '/projects/app1',
        alias: 'app1',
        tags: ['frontend'],
        gitInfo: { branch: 'main', lastCommit: 'abc123', remote: 'origin' },
        registeredAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'repo-2',
        path: '/projects/app2',
        tags: [],
        gitInfo: { branch: 'develop', lastCommit: 'def456' },
        registeredAt: '2026-01-02T00:00:00.000Z',
      },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    store = new ConfigStore('/tmp/config')

    // Default mocks
    mockExistsSync.mockReturnValue(true)
    mockReadFile.mockResolvedValue(JSON.stringify(sampleRepoConfig))
    mockWriteFile.mockResolvedValue(undefined)
    mockMkdir.mockResolvedValue(undefined)
    mockChmod.mockResolvedValue(undefined)
  })

  // ===========================================================================
  // load()
  // ===========================================================================

  describe('load', () => {
    it('should load repositories from config file', async () => {
      // Arrange - default mocks set up

      // Act
      const result = await store.load()

      // Assert
      expect(result.size).toBe(2)
      expect(result.get('repo-1')).toBeDefined()
      expect(result.get('repo-1')?.alias).toBe('app1')
      expect(result.get('repo-2')?.path).toBe('/projects/app2')
    })

    it('should convert registeredAt string to Date object', async () => {
      // Arrange - default mocks set up

      // Act
      const result = await store.load()

      // Assert
      const repo = result.get('repo-1')
      expect(repo?.registeredAt).toBeInstanceOf(Date)
      expect(repo?.registeredAt.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    })

    it('should return empty map when config file does not exist', async () => {
      // Arrange
      mockExistsSync.mockReturnValue(false)

      // Act
      const result = await store.load()

      // Assert
      expect(result.size).toBe(0)
      expect(mockReadFile).not.toHaveBeenCalled()
    })

    it('should throw error for unsupported config version', async () => {
      // Arrange
      mockReadFile.mockResolvedValue(JSON.stringify({
        version: 99,
        repositories: [],
      }))

      // Act & Assert
      await expect(store.load())
        .rejects
        .toThrow('Unsupported config version: 99. Expected version 1.')
    })

    it('should throw error for invalid JSON', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('{ invalid json }')

      // Act & Assert
      await expect(store.load()).rejects.toThrow()
    })

    it('should handle empty repositories array', async () => {
      // Arrange
      mockReadFile.mockResolvedValue(JSON.stringify({
        version: 1,
        repositories: [],
      }))

      // Act
      const result = await store.load()

      // Assert
      expect(result.size).toBe(0)
    })
  })

  // ===========================================================================
  // save()
  // ===========================================================================

  describe('save', () => {
    it('should save repositories to config file', async () => {
      // Arrange
      const repos = new Map([
        ['id-1', {
          id: 'id-1',
          path: '/projects/app',
          alias: 'my-app',
          tags: ['test'],
          gitInfo: { branch: 'main', lastCommit: 'abc', remote: 'origin' },
          registeredAt: new Date('2026-01-15T00:00:00.000Z'),
        }],
      ])

      // Act
      await store.save(repos)

      // Assert
      expect(mockWriteFile).toHaveBeenCalledTimes(1)
      const writtenContent = JSON.parse(mockWriteFile.mock.calls[0][1])
      expect(writtenContent.version).toBe(1)
      expect(writtenContent.repositories).toHaveLength(1)
      expect(writtenContent.repositories[0].id).toBe('id-1')
      expect(writtenContent.repositories[0].registeredAt).toBe('2026-01-15T00:00:00.000Z')
    })

    it('should create config directory if it does not exist', async () => {
      // Arrange
      mockExistsSync.mockReturnValue(false)
      const repos = new Map()

      // Act
      await store.save(repos)

      // Assert
      expect(mockMkdir).toHaveBeenCalledWith('/tmp/config', { recursive: true })
    })

    it('should not create directory if it already exists', async () => {
      // Arrange
      mockExistsSync.mockReturnValue(true)
      const repos = new Map()

      // Act
      await store.save(repos)

      // Assert
      expect(mockMkdir).not.toHaveBeenCalled()
    })

    it('should set secure file permissions', async () => {
      // Arrange
      const repos = new Map()

      // Act
      await store.save(repos)

      // Assert
      expect(mockChmod).toHaveBeenCalledWith('/tmp/config/repositories.json', 0o600)
    })

    it('should handle chmod failure gracefully', async () => {
      // Arrange
      mockChmod.mockRejectedValue(new Error('Permission denied'))
      const repos = new Map()

      // Act - should not throw
      await store.save(repos)

      // Assert
      expect(mockWriteFile).toHaveBeenCalled()
    })

    it('should handle concurrent saves with mutex', async () => {
      // Arrange
      const repos = new Map([
        ['id-1', {
          id: 'id-1',
          path: '/projects/app',
          tags: [],
          gitInfo: { branch: 'main', lastCommit: 'abc' },
          registeredAt: new Date(),
        }],
      ])

      // Make writeFile slow to test mutex
      mockWriteFile.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 50)))

      // Act - trigger concurrent saves
      const saves = Promise.all([
        store.save(repos),
        store.save(repos),
        store.save(repos),
      ])

      await saves

      // Assert - all saves should complete (mutex ensures sequential execution)
      expect(mockWriteFile).toHaveBeenCalledTimes(3)
    })
  })
})
