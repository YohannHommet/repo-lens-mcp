import { extname } from 'node:path'
import { Lang } from '@ast-grep/napi'

const EXTENSION_TO_LANG: Record<string, Lang> = {
  '.ts': Lang.TypeScript,
  '.tsx': Lang.Tsx,
  '.js': Lang.JavaScript,
  '.jsx': Lang.JavaScript,
  '.mjs': Lang.JavaScript,
  '.cjs': Lang.JavaScript,
}

const EXTENSION_TO_LANG_NAME: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
}

export function getLangFromFile(filePath: string): Lang | null {
  const ext = extname(filePath).toLowerCase()
  return EXTENSION_TO_LANG[ext] || null
}

export function getLangNameFromFile(filePath: string): string | null {
  const ext = extname(filePath).toLowerCase()
  return EXTENSION_TO_LANG_NAME[ext] || null
}

export function isSupportedFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase()
  return ext in EXTENSION_TO_LANG
}

export function getSupportedExtensions(): string[] {
  return Object.keys(EXTENSION_TO_LANG)
}
