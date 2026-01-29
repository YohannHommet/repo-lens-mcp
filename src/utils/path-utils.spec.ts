import * as fs from 'node:fs'
import * as fsPromises from 'node:fs/promises'
import * as path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getLanguageForFile,
  getRelativePath,
  isSubPath,
  isValidDirectory,
  normalizePath,
  safeOpenFile,
  safeRealPath,
} from './path-utils.js'

// Mock fs and path modules
vi.mock('fs')
vi.mock('fs/promises')
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

  describe('safeRealPath', () => {
    it('should return realpath for existing path', () => {
      vi.mocked(fs.realpathSync).mockReturnValue('/real/path')
      const result = safeRealPath('/some/path')
      expect(result).toBe('/real/path')
    })

    it('should fall back to resolve when path does not exist', () => {
      vi.mocked(fs.realpathSync).mockImplementation(() => {
        throw new Error('ENOENT')
      })
      vi.mocked(path.resolve).mockReturnValue('/resolved/path')

      const result = safeRealPath('/nonexistent/path')
      expect(result).toBe('/resolved/path')
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

  describe('getLanguageForFile', () => {
    it('should return typescript for .ts files', () => {
      expect(getLanguageForFile('file.ts')).toBe('typescript')
    })

    it('should return typescript for .tsx files', () => {
      expect(getLanguageForFile('component.tsx')).toBe('typescript')
    })

    it('should return javascript for .js files', () => {
      expect(getLanguageForFile('script.js')).toBe('javascript')
    })

    it('should return javascript for .jsx files', () => {
      expect(getLanguageForFile('component.jsx')).toBe('javascript')
    })

    it('should return python for .py files', () => {
      expect(getLanguageForFile('script.py')).toBe('python')
    })

    it('should return rust for .rs files', () => {
      expect(getLanguageForFile('main.rs')).toBe('rust')
    })

    it('should return go for .go files', () => {
      expect(getLanguageForFile('main.go')).toBe('go')
    })

    it('should return empty string for unknown extension', () => {
      expect(getLanguageForFile('file.xyz')).toBe('')
    })

    it('should return empty string for file without extension', () => {
      expect(getLanguageForFile('Makefile')).toBe('')
    })

    it('should handle uppercase extensions via toLowerCase', () => {
      // The function uses toLowerCase() on the extension
      // So uppercase extensions should work
      expect(getLanguageForFile('file.TS')).toBe('typescript')
    })
  })

  describe('isSubPath', () => {
    beforeEach(() => {
      vi.mocked(fs.realpathSync).mockImplementation(p => p as string)
      vi.mocked(path.resolve).mockImplementation((...args) => args.join('/'))
      vi.mocked(path.relative).mockImplementation((from, to) => {
        if (to.startsWith(from)) {
          const rel = to.slice(from.length)
          return rel.startsWith('/') ? rel.slice(1) : rel
        }
        return `../${to}`
      })
    })

    it('should return true for child path', () => {
      const parent = '/data'
      const child = '/data/file.txt'
      expect(isSubPath(parent, child)).toBe(true)
    })

    it('should return false for parent path', () => {
      const parent = '/data/subdir'
      const child = '/data'
      expect(isSubPath(parent, child)).toBe(false)
    })

    it('should return false for path traversal', () => {
      const parent = '/data'
      const child = '/data/../etc/passwd'

      vi.mocked(fs.realpathSync).mockImplementation((p) => {
        if (p === '/data/../etc/passwd')
          return '/etc/passwd'
        return p as string
      })

      expect(isSubPath(parent, child)).toBe(false)
    })

    it('should resolve symlinks', () => {
      const parent = '/data'
      const child = '/data/link'

      vi.mocked(fs.realpathSync).mockImplementation((p) => {
        if (p === '/data/link')
          return '/etc/passwd'
        return p as string
      })

      expect(isSubPath(parent, child)).toBe(false)
    })

    it('should return false when an error occurs in path resolution', () => {
      // Make relative throw an error to trigger the catch block
      vi.mocked(path.relative).mockImplementation(() => {
        throw new Error('Path resolution error')
      })

      expect(isSubPath('/parent', '/parent/child')).toBe(false)
    })

    it('should return false for same path (empty relative)', () => {
      vi.mocked(path.relative).mockReturnValue('')
      expect(isSubPath('/data', '/data')).toBe(false)
    })

    it('should return false for absolute relative path', () => {
      vi.mocked(path.relative).mockReturnValue('/absolute')
      vi.mocked(path.isAbsolute).mockReturnValue(true)
      expect(isSubPath('/data', '/other')).toBe(false)
    })
  })

  describe('safeOpenFile', () => {
    const mockFileHandle = {
      fd: 123,
      close: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn(),
    }

    beforeEach(() => {
      vi.mocked(fsPromises.open).mockResolvedValue(mockFileHandle as any)
      vi.mocked(fs.constants).O_RDONLY = 0
      vi.mocked(fs.constants).O_NOFOLLOW = 0x20000
      // Default: make isSubPath return true for /data/* paths
      vi.mocked(fs.realpathSync).mockImplementation(p => p as string)
      vi.mocked(path.relative).mockImplementation((from, to) => {
        // /data/file.txt relative to /data = file.txt (valid subpath)
        if (from === '/data' && to.startsWith('/data/')) {
          return to.slice('/data/'.length)
        }
        // /etc/passwd relative to /data = ../etc/passwd (invalid)
        if (from === '/data' && to.startsWith('/etc/')) {
          return `..${to}`
        }
        if (to.startsWith(`${from}/`)) {
          return to.slice(from.length + 1)
        }
        return `../${to}`
      })
      vi.mocked(path.isAbsolute).mockImplementation(p => p.startsWith('/'))
      mockFileHandle.close.mockClear()
    })

    it('should open valid file', async () => {
      vi.mocked(fs.realpathSync).mockImplementation((p) => {
        if (typeof p === 'string' && p.includes('/proc/self/fd/'))
          return '/data/file.txt'
        return p as string
      })

      const result = await safeOpenFile('/data/file.txt', '/data')
      expect(fsPromises.open).toHaveBeenCalledWith('/data/file.txt', expect.any(Number))
      expect(result.fd).toBe(mockFileHandle)
    })

    it('should return working close function', async () => {
      vi.mocked(fs.realpathSync).mockImplementation((p) => {
        if (typeof p === 'string' && p.includes('/proc/self/fd/'))
          return '/data/file.txt'
        return p as string
      })

      const result = await safeOpenFile('/data/file.txt', '/data')
      await result.close()
      expect(mockFileHandle.close).toHaveBeenCalled()
    })

    it('should throw if file is outside allowed dir', async () => {
      vi.mocked(fs.realpathSync).mockImplementation(p => p as string)

      await expect(safeOpenFile('/etc/passwd', '/data'))
        .rejects
        .toThrow('File is not within allowed directory')
    })

    it('should throw on symlink error (ELOOP)', async () => {
      vi.mocked(fsPromises.open).mockRejectedValue({ code: 'ELOOP' })

      await expect(safeOpenFile('/data/link', '/data'))
        .rejects
        .toThrow('File is a symbolic link')
    })

    it('should throw on symlink error (EMLINK)', async () => {
      vi.mocked(fsPromises.open).mockRejectedValue({ code: 'EMLINK' })

      await expect(safeOpenFile('/data/link', '/data'))
        .rejects
        .toThrow('File is a symbolic link')
    })

    it('should rethrow other open errors', async () => {
      // First make isSubPath return true
      vi.mocked(fs.realpathSync).mockImplementation(p => p as string)
      vi.mocked(path.relative).mockReturnValue('file.txt')
      vi.mocked(path.isAbsolute).mockReturnValue(false)

      vi.mocked(fsPromises.open).mockRejectedValue(new Error('EACCES'))

      await expect(safeOpenFile('/data/file.txt', '/data'))
        .rejects
        .toThrow('EACCES')
    })

    it('should detect symlink attack via /proc/self/fd on Linux', async () => {
      // Save original platform
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })

      // Make initial isSubPath check pass, but /proc check should fail
      let callCount = 0
      vi.mocked(fs.realpathSync).mockImplementation((p) => {
        callCount++
        // First two calls are for isSubPath (parent and child)
        if (callCount <= 2)
          return p as string
        // Third call is /proc/self/fd check - return path outside allowed dir
        if (typeof p === 'string' && p.includes('/proc/self/fd/'))
          return '/etc/passwd'
        return p as string
      })
      vi.mocked(path.relative).mockImplementation((from, to) => {
        if (to === '/etc/passwd')
          return '../etc/passwd'
        if (to.startsWith(from)) {
          const rel = to.slice(from.length)
          return rel.startsWith('/') ? rel.slice(1) : rel
        }
        return `../${to}`
      })

      await expect(safeOpenFile('/data/file.txt', '/data'))
        .rejects
        .toThrow('Symlink attack detected')

      expect(mockFileHandle.close).toHaveBeenCalled()

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
    })

    it('should continue if /proc/self/fd check fails with non-security error', async () => {
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })

      let callCount = 0
      vi.mocked(fs.realpathSync).mockImplementation((p) => {
        callCount++
        // First two calls are for isSubPath
        if (callCount <= 2)
          return p as string
        // /proc check throws non-security error
        if (typeof p === 'string' && p.includes('/proc/self/fd/'))
          throw new Error('ENOENT')
        return p as string
      })

      const result = await safeOpenFile('/data/file.txt', '/data')
      expect(result.fd).toBe(mockFileHandle)

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
    })

    it('should close handle and rethrow on outer catch block', async () => {
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })

      let callCount = 0
      vi.mocked(fs.realpathSync).mockImplementation((p) => {
        callCount++
        // First two calls are for isSubPath
        if (callCount <= 2)
          return p as string
        // Throw error with "outside allowed directory" in message
        if (typeof p === 'string' && p.includes('/proc/self/fd/'))
          throw new Error('Symlink attack: real path outside allowed directory')
        return p as string
      })

      await expect(safeOpenFile('/data/file.txt', '/data'))
        .rejects
        .toThrow('outside allowed directory')

      expect(mockFileHandle.close).toHaveBeenCalled()

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
    })
  })
})
