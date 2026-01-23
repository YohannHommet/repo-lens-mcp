import type { GitInfo } from '../types/repository.js'
import { extname } from 'node:path'

import fg from 'fast-glob'
import { DEFAULT_IGNORE_PATTERNS, getLanguageFromExtension } from '../constants.js'
import { getGitInfo, isGitRepository } from '../utils/git-utils.js'
import { logger } from '../utils/logger.js'
import { isValidDirectory, normalizePath } from '../utils/path-utils.js'

export class RepositoryScanner {
  async validatePath(path: string): Promise<string> {
    const normalizedPath = normalizePath(path)

    if (!isValidDirectory(normalizedPath)) {
      throw new Error(`Invalid directory: ${path}`)
    }

    if (!(await isGitRepository(normalizedPath))) {
      throw new Error(`Not a git repository: ${path}`)
    }

    return normalizedPath
  }

  async scan(path: string): Promise<{
    gitInfo: GitInfo
    languages: string[]
    fileCount: number
  }> {
    const [gitInfo, languages, fileCount] = await Promise.all([
      getGitInfo(path),
      this.detectLanguages(path),
      this.countFiles(path),
    ])

    return { gitInfo, languages, fileCount }
  }

  private async detectLanguages(path: string): Promise<string[]> {
    const languages = new Set<string>()

    try {
      const files = await fg(['**/*'], {
        cwd: path,
        ignore: DEFAULT_IGNORE_PATTERNS,
        onlyFiles: true,
        deep: 5,
      })

      for (const file of files.slice(0, 1000)) {
        const ext = extname(file)
        const lang = getLanguageFromExtension(ext)
        if (lang) {
          languages.add(lang)
        }
      }
    }
    catch (error) {
      logger.warn('Failed to detect languages', { error })
    }

    return Array.from(languages)
  }

  private async countFiles(path: string): Promise<number> {
    try {
      const files = await fg(['**/*'], {
        cwd: path,
        ignore: DEFAULT_IGNORE_PATTERNS,
        onlyFiles: true,
      })
      return files.length
    }
    catch {
      return 0
    }
  }
}
