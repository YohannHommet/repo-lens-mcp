import * as fs from 'node:fs'
import * as path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getRelativePath,
  isValidDirectory,
  normalizePath,
} from './path-utils.js'

// Mock fs and path modules
vi.mock('fs')
vi.mock('path', async () => {
  const actual = await vi.importActual('path')
  return {
    ...actual,
    resolve: vi.fn((...args) => args.join('/')),
    relative: vi.fn((from, to) => {
      if (to.startsWith(from)) {
        return to.slice(from.length + 1)
      }
      return `../${to}`
    }),
    isAbsolute: vi.fn(p => p.startsWith('/')),
  }
})

describe('path Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('normalizePath', () => {
    it('should resolve path', () => {
      const result = normalizePath('/foo/bar')
      expect(result).toBeDefined()
    })
  })

  describe('isValidDirectory', () => {
    it('should return true for valid directory', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any)

      expect(isValidDirectory('/valid/dir')).toBe(true)
    })

    it('should return false for non-existent path', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)

      expect(isValidDirectory('/nonexistent')).toBe(false)
    })

    it('should return false for file (not directory)', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as any)

      expect(isValidDirectory('/path/to/file.txt')).toBe(false)
    })

    it('should return false when stat throws', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.statSync).mockImplementation(() => {
        throw new Error('Permission denied')
      })

      expect(isValidDirectory('/no/access')).toBe(false)
    })
  })

  describe('getRelativePath', () => {
    it('should return relative path', () => {
      vi.mocked(path.relative).mockReturnValue('src/index.ts')

      const result = getRelativePath('/project', '/project/src/index.ts')
      expect(result).toBe('src/index.ts')
    })
  })
})
