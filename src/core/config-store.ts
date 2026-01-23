import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { Mutex } from 'async-mutex';

import type { Repository } from '../types/repository.js';
import type { RepositoriesConfig } from '../config/types.js';
import { logger } from '../utils/logger.js';

export class ConfigStore {
  private configPath: string;
  private saveMutex = new Mutex();

  constructor(configDir: string) {
    this.configPath = join(configDir, 'repositories.json');
  }

  async load(): Promise<Map<string, Repository>> {
    const repositories = new Map<string, Repository>();

    if (!existsSync(this.configPath)) {
      logger.info('No configuration file found, starting fresh');
      return repositories;
    }

    try {
      const content = await readFile(this.configPath, 'utf-8');
      const config: RepositoriesConfig = JSON.parse(content);

      // Version compatibility check
      const SUPPORTED_VERSION = 1;
      if (config.version !== SUPPORTED_VERSION) {
        throw new Error(
          `Unsupported config version: ${config.version}. Expected version ${SUPPORTED_VERSION}.`
        );
      }

      for (const serialized of config.repositories) {
        const repo: Repository = {
          ...serialized,
          lastScanned: new Date(serialized.lastScanned),
        };
        repositories.set(repo.id, repo);
      }

      logger.info('Configuration loaded', { repositoryCount: repositories.size });
      return repositories;
    } catch (error) {
      logger.error('Failed to load configuration', { error });
      throw error;
    }
  }

  async save(repositories: Map<string, Repository>): Promise<void> {
    const release = await this.saveMutex.acquire();
    try {
      const dir = dirname(this.configPath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      const config: RepositoriesConfig = {
        version: 1,
        repositories: Array.from(repositories.values()).map((repo) => ({
          ...repo,
          lastScanned: repo.lastScanned.toISOString(),
        })),
      };

      await writeFile(this.configPath, JSON.stringify(config, null, 2));

      // Set secure permissions: owner read/write only
      try {
        const { chmod } = await import('fs/promises');
        await chmod(this.configPath, 0o600);
      } catch (error) {
        logger.warn('Failed to set config file permissions', { error });
      }

      logger.debug('Configuration saved', { path: this.configPath });
    } finally {
      release();
    }
  }
}
