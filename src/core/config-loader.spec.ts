import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConfigLoader } from './config-loader.js'

// =============================================================================
// Mocks
// =============================================================================

const mockExistsSync = vi.fn()
const mockReadFile = vi.fn()

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
}))

vi.mock('node:fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
}))

vi.mock('node:os', () => ({
  homedir: () => '/home/testuser',
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

describe('configLoader', () => {
  const validYaml = `repositories:
  - path: ~/projects/app1
    alias: app1
  - path: /absolute/path/app2
`

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('load', () => {
    it('should parse YAML config and expand ~ in paths', async () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFile.mockResolvedValue(validYaml)

      const loader = new ConfigLoader('/tmp/repolens.yaml')
      const result = await loader.load()

      expect(result).toEqual([
        { path: '/home/testuser/projects/app1', alias: 'app1' },
        { path: '/absolute/path/app2' },
      ])
      expect(mockReadFile).toHaveBeenCalledWith('/tmp/repolens.yaml', 'utf-8')
    })

    it('should return empty array when config file path is null', async () => {
      const loader = new ConfigLoader(null)
      const result = await loader.load()

      expect(result).toEqual([])
      expect(mockReadFile).not.toHaveBeenCalled()
    })

    it('should return empty array when default config does not exist', async () => {
      mockExistsSync.mockReturnValue(false)

      // Ensure --config is NOT in argv (default path scenario)
      const originalArgv = process.argv
      process.argv = ['node', 'index.js']

      const loader = new ConfigLoader('/home/testuser/.config/repo-lens-mcp/repolens.yaml')
      const result = await loader.load()

      expect(result).toEqual([])
      process.argv = originalArgv
    })

    it('should throw when explicit --config path does not exist', async () => {
      mockExistsSync.mockReturnValue(false)

      const originalArgv = process.argv
      process.argv = ['node', 'index.js', '--config', '/missing/repolens.yaml']

      const loader = new ConfigLoader('/missing/repolens.yaml')

      await expect(loader.load()).rejects.toThrow('Config file not found: /missing/repolens.yaml')
      process.argv = originalArgv
    })

    it('should throw on invalid YAML structure', async () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFile.mockResolvedValue('repositories: "not an array"')

      const loader = new ConfigLoader('/tmp/repolens.yaml')

      await expect(loader.load()).rejects.toThrow()
    })

    it('should throw when repository path is empty', async () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFile.mockResolvedValue(`repositories:
  - path: ""
    alias: bad
`)

      const loader = new ConfigLoader('/tmp/repolens.yaml')

      await expect(loader.load()).rejects.toThrow()
    })

    it('should handle empty repositories array', async () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFile.mockResolvedValue('repositories: []')

      const loader = new ConfigLoader('/tmp/repolens.yaml')
      const result = await loader.load()

      expect(result).toEqual([])
    })
  })
})
