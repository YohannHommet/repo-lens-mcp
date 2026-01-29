import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RepositoryScanner } from './repository-scanner.js'

// =============================================================================
// Mocks
// =============================================================================

const mockGetGitInfo = vi.fn()
const mockIsGitRepository = vi.fn()
const mockIsValidDirectory = vi.fn()
const mockNormalizePath = vi.fn()

vi.mock('../utils/git-utils.js', () => ({
  getGitInfo: (...args: unknown[]) => mockGetGitInfo(...args),
  isGitRepository: (...args: unknown[]) => mockIsGitRepository(...args),
}))

vi.mock('../utils/path-utils.js', () => ({
  isValidDirectory: (...args: unknown[]) => mockIsValidDirectory(...args),
  normalizePath: (...args: unknown[]) => mockNormalizePath(...args),
}))

// =============================================================================
// Test Suite
// =============================================================================

describe('repositoryScanner', () => {
  let scanner: RepositoryScanner

  beforeEach(() => {
    vi.clearAllMocks()
    scanner = new RepositoryScanner()

    // Default mocks
    mockNormalizePath.mockImplementation((p: string) => p)
    mockIsValidDirectory.mockReturnValue(true)
    mockIsGitRepository.mockResolvedValue(true)
    mockGetGitInfo.mockResolvedValue({
      branch: 'main',
      lastCommit: 'abc123',
      remote: 'origin',
    })
  })

  // ===========================================================================
  // validatePath()
  // ===========================================================================

  describe('validatePath', () => {
    it('should return normalized path for valid git repository', async () => {
      // Arrange
      const inputPath = '/projects/my-app'
      mockNormalizePath.mockReturnValue('/projects/my-app')

      // Act
      const result = await scanner.validatePath(inputPath)

      // Assert
      expect(result).toBe('/projects/my-app')
      expect(mockNormalizePath).toHaveBeenCalledWith(inputPath)
      expect(mockIsValidDirectory).toHaveBeenCalledWith('/projects/my-app')
      expect(mockIsGitRepository).toHaveBeenCalledWith('/projects/my-app')
    })

    it('should throw error for invalid directory', async () => {
      // Arrange
      mockIsValidDirectory.mockReturnValue(false)

      // Act & Assert
      await expect(scanner.validatePath('/invalid/path'))
        .rejects
        .toThrow('Invalid directory: /invalid/path')
    })

    it('should throw error for non-git repository', async () => {
      // Arrange
      mockIsGitRepository.mockResolvedValue(false)

      // Act & Assert
      await expect(scanner.validatePath('/not/a/git/repo'))
        .rejects
        .toThrow('Not a git repository: /not/a/git/repo')
    })

    it('should normalize path with trailing slash', async () => {
      // Arrange
      mockNormalizePath.mockReturnValue('/projects/app')

      // Act
      await scanner.validatePath('/projects/app/')

      // Assert
      expect(mockNormalizePath).toHaveBeenCalledWith('/projects/app/')
    })
  })

  // ===========================================================================
  // scan()
  // ===========================================================================

  describe('scan', () => {
    it('should return git info for valid repository', async () => {
      // Arrange
      const expectedGitInfo = {
        branch: 'develop',
        lastCommit: 'def456',
        remote: 'upstream',
      }
      mockGetGitInfo.mockResolvedValue(expectedGitInfo)

      // Act
      const result = await scanner.scan('/projects/app')

      // Assert
      expect(result).toEqual({ gitInfo: expectedGitInfo })
      expect(mockGetGitInfo).toHaveBeenCalledWith('/projects/app')
    })

    it('should handle repository without remote', async () => {
      // Arrange
      mockGetGitInfo.mockResolvedValue({
        branch: 'main',
        lastCommit: 'abc123',
        remote: undefined,
      })

      // Act
      const result = await scanner.scan('/projects/local-only')

      // Assert
      expect(result.gitInfo.remote).toBeUndefined()
    })

    it('should propagate git info errors', async () => {
      // Arrange
      mockGetGitInfo.mockRejectedValue(new Error('Git command failed'))

      // Act & Assert
      await expect(scanner.scan('/projects/broken'))
        .rejects
        .toThrow('Git command failed')
    })
  })
})
