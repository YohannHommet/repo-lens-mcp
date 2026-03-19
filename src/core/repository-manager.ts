import type { Repository } from '../types/repository.js'

import { logger } from '../utils/logger.js'
import { normalizePath } from '../utils/path-utils.js'
import { ConfigLoader } from './config-loader.js'
import { RepositoryScanner } from './repository-scanner.js'

export class RepositoryManager {
  private repositories: Map<string, Repository> = new Map()
  private loader: ConfigLoader
  private scanner: RepositoryScanner

  constructor(loader: ConfigLoader) {
    this.loader = loader
    this.scanner = new RepositoryScanner()
  }

  async load(): Promise<void> {
    const entries = await this.loader.load()
    const results = await Promise.all(
      entries.map(entry =>
        this.scanRepository(entry.path, entry.alias).catch((error) => {
          logger.warn('Skipping invalid repository from config', { path: entry.path, error })
          return null
        }),
      ),
    )

    for (const repo of results) {
      if (repo) {
        this.repositories.set(repo.id, repo)
      }
    }
    logger.info('Repositories loaded', { count: this.repositories.size })
  }

  list(): Repository[] {
    return Array.from(this.repositories.values())
  }

  get(identifier: string): Repository | null {
    return this.resolveIdentifier(identifier)
  }

  resolveIdentifier(identifier: string): Repository | null {
    const normalizedPath = normalizePath(identifier)
    if (this.repositories.has(normalizedPath)) {
      return this.repositories.get(normalizedPath)!
    }

    for (const repo of this.repositories.values()) {
      if (repo.alias === identifier) {
        return repo
      }
    }

    return null
  }

  resolveIdentifiers(identifiers?: string[]): Repository[] {
    if (!identifiers || identifiers.length === 0) {
      return this.list()
    }

    const repos: Repository[] = []
    for (const id of identifiers) {
      const repo = this.resolveIdentifier(id)
      if (repo) {
        repos.push(repo)
      }
    }
    return repos
  }

  createAdHocRepositories(paths: string[]): Repository[] {
    return paths.map((p) => {
      const normalized = normalizePath(p)
      const dirName = normalized.split('/').pop() || normalized
      return {
        id: normalized,
        path: normalized,
        alias: dirName,
        gitInfo: { branch: 'unknown', lastCommit: 'unknown' },
        registeredAt: new Date(),
      }
    })
  }

  private async scanRepository(path: string, alias?: string): Promise<Repository> {
    const normalizedPath = await this.scanner.validatePath(path)
    const { gitInfo } = await this.scanner.scan(normalizedPath)
    return {
      id: normalizedPath,
      path: normalizedPath,
      alias,
      gitInfo,
      registeredAt: new Date(),
    }
  }
}
