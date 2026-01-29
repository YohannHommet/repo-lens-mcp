import type { GitInfo } from '../types/repository.js'

import { getGitInfo, isGitRepository } from '../utils/git-utils.js'
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

  async scan(path: string): Promise<{ gitInfo: GitInfo }> {
    const gitInfo = await getGitInfo(path)
    return { gitInfo }
  }
}
