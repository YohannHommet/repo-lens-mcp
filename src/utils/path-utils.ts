import { existsSync, statSync } from 'node:fs'
import { relative, resolve } from 'node:path'

export function normalizePath(path: string): string {
  return resolve(path)
}

export function isValidDirectory(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isDirectory()
  }
  catch {
    return false
  }
}

export function getRelativePath(basePath: string, filePath: string): string {
  return relative(basePath, filePath)
}

