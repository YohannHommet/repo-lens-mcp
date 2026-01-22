import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { randomUUID } from 'crypto';
import fg from 'fast-glob';

import type { Repository, RegisterOptions, RepositoryFilter } from '../types/repository.js';
import type { RepositoriesConfig } from '../config/types.js';
import { getGitInfo, isGitRepository } from '../utils/git-utils.js';
import { normalizePath, isValidDirectory, isSubPath } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';
import { DEFAULT_IGNORE_PATTERNS, getLanguageFromExtension } from '../constants.js';

export class RepositoryManager {
  private repositories: Map<string, Repository> = new Map();
  private configPath: string;

  constructor(configDir: string) {
    this.configPath = join(configDir, 'repositories.json');
  }

  async register(path: string, options?: RegisterOptions): Promise<Repository> {
    const normalizedPath = normalizePath(path);

    if (!isValidDirectory(normalizedPath)) {
      throw new Error(`Invalid directory: ${path}`);
    }

    if (!(await isGitRepository(normalizedPath))) {
      throw new Error(`Not a git repository: ${path}`);
    }

    // Check if already registered
    for (const repo of this.repositories.values()) {
      if (repo.path === normalizedPath) {
        throw new Error(`Repository already registered: ${path}`);
      }
    }

    // Check alias uniqueness
    if (options?.alias) {
      for (const repo of this.repositories.values()) {
        if (repo.alias === options.alias) {
          throw new Error(`Alias already in use: ${options.alias}`);
        }
      }
    }

    const gitInfo = await getGitInfo(normalizedPath);
    const languages = await this.detectLanguages(normalizedPath);
    const fileCount = await this.countFiles(normalizedPath);

    const repository: Repository = {
      id: randomUUID(),
      path: normalizedPath,
      alias: options?.alias,
      tags: options?.tags || [],
      gitInfo,
      languages,
      lastScanned: new Date(),
      fileCount,
    };

    this.repositories.set(repository.id, repository);
    await this.save();

    logger.info('Repository registered', { id: repository.id, path: normalizedPath });

    return repository;
  }

  async unregister(identifier: string): Promise<void> {
    const repo = this.resolveIdentifier(identifier);
    if (!repo) {
      throw new Error(`Repository not found: ${identifier}`);
    }

    this.repositories.delete(repo.id);
    await this.save();

    logger.info('Repository unregistered', { id: repo.id });
  }

  async list(filter?: RepositoryFilter): Promise<Repository[]> {
    let repos = Array.from(this.repositories.values());

    if (filter?.tags && filter.tags.length > 0) {
      repos = repos.filter((repo) => filter.tags!.some((tag) => repo.tags.includes(tag)));
    }

    return repos;
  }

  async get(identifier: string): Promise<Repository | null> {
    return this.resolveIdentifier(identifier);
  }

  async refresh(identifier: string): Promise<Repository> {
    const repo = this.resolveIdentifier(identifier);
    if (!repo) {
      throw new Error(`Repository not found: ${identifier}`);
    }

    repo.gitInfo = await getGitInfo(repo.path);
    repo.languages = await this.detectLanguages(repo.path);
    repo.fileCount = await this.countFiles(repo.path);
    repo.lastScanned = new Date();

    await this.save();

    logger.info('Repository refreshed', { id: repo.id });

    return repo;
  }

  resolveIdentifier(identifier: string): Repository | null {
    // Try by ID
    if (this.repositories.has(identifier)) {
      return this.repositories.get(identifier)!;
    }

    // Try by alias
    for (const repo of this.repositories.values()) {
      if (repo.alias === identifier) {
        return repo;
      }
    }

    // Try by path
    const normalizedPath = normalizePath(identifier);
    for (const repo of this.repositories.values()) {
      if (repo.path === normalizedPath) {
        return repo;
      }
    }

    return null;
  }

  resolveIdentifiers(identifiers?: string[]): Repository[] {
    if (!identifiers || identifiers.length === 0) {
      return Array.from(this.repositories.values());
    }

    const repos: Repository[] = [];
    for (const id of identifiers) {
      const repo = this.resolveIdentifier(id);
      if (repo) {
        repos.push(repo);
      }
    }
    return repos;
  }

  resolvePath(filePath: string): { repo: Repository; relativePath: string } | null {
    const normalizedPath = normalizePath(filePath);

    for (const repo of this.repositories.values()) {
      if (isSubPath(repo.path, normalizedPath)) {
        const relativePath = normalizedPath.slice(repo.path.length + 1);
        return { repo, relativePath };
      }
    }

    return null;
  }

  async save(): Promise<void> {
    const dir = dirname(this.configPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    const config: RepositoriesConfig = {
      version: 1,
      repositories: Array.from(this.repositories.values()).map((repo) => ({
        ...repo,
        lastScanned: repo.lastScanned.toISOString(),
      })),
    };

    await writeFile(this.configPath, JSON.stringify(config, null, 2));
    logger.debug('Configuration saved', { path: this.configPath });
  }

  async load(): Promise<void> {
    if (!existsSync(this.configPath)) {
      logger.info('No configuration file found, starting fresh');
      return;
    }

    try {
      const content = await readFile(this.configPath, 'utf-8');
      const config: RepositoriesConfig = JSON.parse(content);

      this.repositories.clear();

      for (const serialized of config.repositories) {
        const repo: Repository = {
          ...serialized,
          lastScanned: new Date(serialized.lastScanned),
        };
        this.repositories.set(repo.id, repo);
      }

      logger.info('Configuration loaded', { repositoryCount: this.repositories.size });
    } catch (error) {
      logger.error('Failed to load configuration', { error });
      throw new Error('Failed to load configuration');
    }
  }

  private async detectLanguages(path: string): Promise<string[]> {
    const languages = new Set<string>();

    try {
      const files = await fg(['**/*'], {
        cwd: path,
        ignore: DEFAULT_IGNORE_PATTERNS,
        onlyFiles: true,
        deep: 5,
      });

      for (const file of files.slice(0, 1000)) {
        const ext = extname(file);
        const lang = getLanguageFromExtension(ext);
        if (lang) {
          languages.add(lang);
        }
      }
    } catch (error) {
      logger.warn('Failed to detect languages', { error });
    }

    return Array.from(languages);
  }

  private async countFiles(path: string): Promise<number> {
    try {
      const files = await fg(['**/*'], {
        cwd: path,
        ignore: DEFAULT_IGNORE_PATTERNS,
        onlyFiles: true,
      });
      return files.length;
    } catch {
      return 0;
    }
  }
}
