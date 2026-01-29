import type { Repository, RepositoryFilter } from '../types/repository.js'

import { randomUUID } from 'node:crypto'
import { logger } from '../utils/logger.js'
import { isSubPath, normalizePath } from '../utils/path-utils.js'
import { ConfigStore } from './config-store.js'
import { RepositoryScanner } from './repository-scanner.js'

export interface RegisterOptions {
  alias?: string
  tags?: string[]
  force?: boolean
}

export class RepositoryManager {
  private repositories: Map<string, Repository> = new Map()
  private store: ConfigStore
  private scanner: RepositoryScanner

  constructor(configDir: string) {
    this.store = new ConfigStore(configDir)
    this.scanner = new RepositoryScanner()
  }

  async load(): Promise<void> {
    this.repositories = await this.store.load()
  }

  async register(path: string, options?: RegisterOptions): Promise<Repository> {
    const normalizedPath = await this.scanner.validatePath(path)

    // Check if already registered
    let existingRepo: Repository | null = null
    for (const repo of this.repositories.values()) {
      if (repo.path === normalizedPath) {
        existingRepo = repo
        break
      }
    }

    if (existingRepo) {
      if (options?.force) {
        // Update existing repo
        return this.update(existingRepo, options)
      }
      throw new Error(`Repository already registered: ${path}`)
    }

    // Check alias uniqueness for new registrations
    if (options?.alias) {
      for (const repo of this.repositories.values()) {
        if (repo.alias === options.alias) {
          throw new Error(`Alias already in use: ${options.alias}`)
        }
      }
    }

    const { gitInfo } = await this.scanner.scan(normalizedPath)

    const repository: Repository = {
      id: randomUUID(),
      path: normalizedPath,
      alias: options?.alias,
      tags: options?.tags || [],
      gitInfo,
      registeredAt: new Date(),
    }

    this.repositories.set(repository.id, repository)
    await this.store.save(this.repositories)

    logger.info('Repository registered', { id: repository.id, path: normalizedPath })

    return repository
  }

  private async update(repo: Repository, options: RegisterOptions): Promise<Repository> {
    // Check alias uniqueness if changing
    if (options.alias && options.alias !== repo.alias) {
      for (const r of this.repositories.values()) {
        if (r.alias === options.alias && r.id !== repo.id) {
          throw new Error(`Alias already in use: ${options.alias}`)
        }
      }
      repo.alias = options.alias
    }

    // Update tags if provided
    if (options.tags !== undefined) {
      repo.tags = options.tags
    }

    // Refresh git info
    const { gitInfo } = await this.scanner.scan(repo.path)
    repo.gitInfo = gitInfo

    await this.store.save(this.repositories)

    logger.info('Repository updated', { id: repo.id, path: repo.path })

    return repo
  }

  async unregister(identifier: string): Promise<void> {
    const repo = this.resolveIdentifier(identifier)
    if (!repo) {
      throw new Error(`Repository not found: ${identifier}`)
    }

    this.repositories.delete(repo.id)
    await this.store.save(this.repositories)

    logger.info('Repository unregistered', { id: repo.id })
  }

  async list(filter?: RepositoryFilter): Promise<Repository[]> {
    let repos = Array.from(this.repositories.values())

    if (filter?.tags && filter.tags.length > 0) {
      repos = repos.filter(repo => filter.tags!.some(tag => repo.tags.includes(tag)))
    }

    return repos
  }

  async get(identifier: string): Promise<Repository | null> {
    return this.resolveIdentifier(identifier)
  }

  resolveIdentifier(identifier: string): Repository | null {
    // Try by ID
    if (this.repositories.has(identifier)) {
      return this.repositories.get(identifier)!
    }

    // Try by alias
    for (const repo of this.repositories.values()) {
      if (repo.alias === identifier) {
        return repo
      }
    }

    // Try by path
    const normalizedPath = normalizePath(identifier)
    for (const repo of this.repositories.values()) {
      if (repo.path === normalizedPath) {
        return repo
      }
    }

    return null
  }

  resolveIdentifiers(identifiers?: string[]): Repository[] {
    if (!identifiers || identifiers.length === 0) {
      return Array.from(this.repositories.values())
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

  resolvePath(filePath: string): { repo: Repository, relativePath: string } | null {
    const normalizedPath = normalizePath(filePath)

    for (const repo of this.repositories.values()) {
      if (isSubPath(repo.path, normalizedPath)) {
        const relativePath = normalizedPath.slice(repo.path.length + 1)
        return { repo, relativePath }
      }
    }

    return null
  }
}
