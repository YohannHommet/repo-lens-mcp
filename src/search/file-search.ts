import fg from 'fast-glob';
import { readFile, stat } from 'fs/promises';
import { join, extname } from 'path';

import type { Repository } from '../types/repository.js';
import type { FileSearchOptions, FileSearchResult } from '../types/search.js';
import { getRelativePath, isSubPath, isValidFile } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';
import { DEFAULT_IGNORE_PATTERNS, getLanguageFromExtension, DEFAULT_MAX_FILE_SIZE } from '../constants.js';

export interface FileInfo {
  filePath: string;
  relativePath: string;
  size: number;
  modified: Date;
  language?: string;
}

export class FileSearchEngine {
  async search(
    options: FileSearchOptions,
    repositories: Repository[]
  ): Promise<FileSearchResult[]> {
    const results: FileSearchResult[] = [];
    const maxPerRepo = options.maxResults
      ? Math.ceil(options.maxResults / repositories.length)
      : 100;

    for (const repo of repositories) {
      try {
        const repoResults = await this.searchInRepo(repo, options.pattern, maxPerRepo);
        results.push(...repoResults);

        if (options.maxResults && results.length >= options.maxResults) {
          break;
        }
      } catch (error) {
        logger.error('Error searching repository files', { repo: repo.path, error });
      }
    }

    if (options.maxResults && results.length > options.maxResults) {
      return results.slice(0, options.maxResults);
    }

    return results;
  }

  private async searchInRepo(
    repo: Repository,
    pattern: string,
    maxResults: number
  ): Promise<FileSearchResult[]> {
    const results: FileSearchResult[] = [];

    // Convert pattern to glob pattern
    const globPattern = pattern.includes('*') ? pattern : `**/*${pattern}*`;

    const files = await fg([globPattern], {
      cwd: repo.path,
      ignore: DEFAULT_IGNORE_PATTERNS,
      absolute: true,
      onlyFiles: true,
    });

    for (const filePath of files.slice(0, maxResults)) {
      results.push({
        repository: repo.id,
        repositoryAlias: repo.alias,
        filePath,
        relativePath: getRelativePath(repo.path, filePath),
      });
    }

    return results;
  }

  async listFiles(
    repo: Repository,
    path?: string,
    glob?: string,
    recursive: boolean = true
  ): Promise<FileSearchResult[]> {
    const basePath = path ? join(repo.path, path) : repo.path;
    const pattern = glob || (recursive ? '**/*' : '*');

    const files = await fg([pattern], {
      cwd: basePath,
      ignore: DEFAULT_IGNORE_PATTERNS,
      absolute: true,
      onlyFiles: true,
      deep: recursive ? Infinity : 1,
    });

    return files.map((filePath) => ({
      repository: repo.id,
      repositoryAlias: repo.alias,
      filePath,
      relativePath: getRelativePath(repo.path, filePath),
    }));
  }

  async getFile(
    repo: Repository,
    filePath: string,
    startLine?: number,
    endLine?: number
  ): Promise<{ content: string; totalLines: number }> {
    // Validate file is within repository
    if (!isSubPath(repo.path, filePath)) {
      throw new Error('File is not within the repository');
    }

    if (!isValidFile(filePath)) {
      throw new Error('File not found');
    }

    // Check file size before reading
    const stats = await stat(filePath);
    if (stats.size > DEFAULT_MAX_FILE_SIZE) {
      throw new Error(`File too large (${Math.round(stats.size / 1024 / 1024)}MB). Maximum size is ${Math.round(DEFAULT_MAX_FILE_SIZE / 1024 / 1024)}MB`);
    }

    let content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const totalLines = lines.length;

    if (startLine !== undefined || endLine !== undefined) {
      const start = (startLine ?? 1) - 1;
      const end = endLine ?? lines.length;
      content = lines.slice(start, end).join('\n');
    }

    return { content, totalLines };
  }

  async getFileInfo(repo: Repository, filePath: string): Promise<FileInfo> {
    if (!isSubPath(repo.path, filePath)) {
      throw new Error('File is not within the repository');
    }

    if (!isValidFile(filePath)) {
      throw new Error('File not found');
    }

    const stats = await stat(filePath);
    const ext = extname(filePath).toLowerCase();

    return {
      filePath,
      relativePath: getRelativePath(repo.path, filePath),
      size: stats.size,
      modified: stats.mtime,
      language: getLanguageFromExtension(ext),
    };
  }
}
