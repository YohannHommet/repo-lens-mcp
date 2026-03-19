import { Lang } from '@ast-grep/napi'
import { describe, expect, it } from 'vitest'
import {
  getLangFromFile,
  getLangNameFromFile,
  getSupportedExtensions,
} from './language-registry.js'

describe('language Registry', () => {
  describe('getLangFromFile', () => {
    it('should return TypeScript for .ts files', () => {
      expect(getLangFromFile('index.ts')).toBe(Lang.TypeScript)
    })

    it('should return Tsx for .tsx files', () => {
      expect(getLangFromFile('Component.tsx')).toBe(Lang.Tsx)
    })

    it('should return JavaScript for .js files', () => {
      expect(getLangFromFile('script.js')).toBe(Lang.JavaScript)
    })

    it('should return JavaScript for .jsx files', () => {
      expect(getLangFromFile('Component.jsx')).toBe(Lang.JavaScript)
    })

    it('should return JavaScript for .mjs files', () => {
      expect(getLangFromFile('module.mjs')).toBe(Lang.JavaScript)
    })

    it('should return JavaScript for .cjs files', () => {
      expect(getLangFromFile('config.cjs')).toBe(Lang.JavaScript)
    })

    it('should return php lang string for .php files', () => {
      expect(getLangFromFile('controller.php')).toBe('php')
    })

    it('should return null for unsupported extensions', () => {
      expect(getLangFromFile('script.py')).toBeNull()
      expect(getLangFromFile('main.go')).toBeNull()
      expect(getLangFromFile('file.rs')).toBeNull()
    })

    it('should return null for files without extension', () => {
      expect(getLangFromFile('Makefile')).toBeNull()
    })

    it('should handle uppercase extensions via toLowerCase', () => {
      // The function uses toLowerCase() so uppercase works
      expect(getLangFromFile('FILE.TS')).toBe(Lang.TypeScript)
    })

    it('should handle paths with directories', () => {
      expect(getLangFromFile('/path/to/file.ts')).toBe(Lang.TypeScript)
      expect(getLangFromFile('src/components/Button.tsx')).toBe(Lang.Tsx)
    })
  })

  describe('getLangNameFromFile', () => {
    it('should return typescript for .ts files', () => {
      expect(getLangNameFromFile('index.ts')).toBe('typescript')
    })

    it('should return tsx for .tsx files', () => {
      expect(getLangNameFromFile('Component.tsx')).toBe('tsx')
    })

    it('should return javascript for .js files', () => {
      expect(getLangNameFromFile('script.js')).toBe('javascript')
    })

    it('should return jsx for .jsx files', () => {
      expect(getLangNameFromFile('Component.jsx')).toBe('jsx')
    })

    it('should return javascript for .mjs files', () => {
      expect(getLangNameFromFile('module.mjs')).toBe('javascript')
    })

    it('should return javascript for .cjs files', () => {
      expect(getLangNameFromFile('config.cjs')).toBe('javascript')
    })

    it('should return php for .php files', () => {
      expect(getLangNameFromFile('controller.php')).toBe('php')
    })

    it('should return null for unsupported extensions', () => {
      expect(getLangNameFromFile('script.py')).toBeNull()
    })
  })

  describe('getSupportedExtensions', () => {
    it('should return all supported extensions', () => {
      const extensions = getSupportedExtensions()

      expect(extensions).toContain('.ts')
      expect(extensions).toContain('.tsx')
      expect(extensions).toContain('.js')
      expect(extensions).toContain('.jsx')
      expect(extensions).toContain('.mjs')
      expect(extensions).toContain('.cjs')
      expect(extensions).toContain('.php')
    })

    it('should return exactly 7 extensions', () => {
      const extensions = getSupportedExtensions()
      expect(extensions).toHaveLength(7)
    })

    it('should not contain unsupported extensions', () => {
      const extensions = getSupportedExtensions()

      expect(extensions).not.toContain('.py')
      expect(extensions).not.toContain('.go')
      expect(extensions).not.toContain('.rs')
    })
  })
})
