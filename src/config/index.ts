import { homedir } from 'os';
import { join } from 'path';
import type { ServerConfig } from './types.js';
import { logger } from '../utils/logger.js';

function parseIntSafe(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < 0) {
    logger.warn(`Invalid config value: ${value}, using default: ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

export function loadConfig(): ServerConfig {
  const configDir =
    process.env.MCP_REPO_SEARCH_CONFIG_DIR?.replace('~', homedir()) ||
    join(homedir(), '.config', 'mcp-repo-search');

  return {
    configDir,
    maxSearchResults: parseIntSafe(process.env.MCP_MAX_SEARCH_RESULTS, 500),
    maxFileSize: parseIntSafe(process.env.MCP_MAX_FILE_SIZE_MB, 10) * 1024 * 1024,
    searchTimeout: parseIntSafe(process.env.MCP_SEARCH_TIMEOUT_MS, 30000),
    cacheEnabled: process.env.MCP_CACHE_ENABLED !== 'false',
    cacheTtl: parseIntSafe(process.env.MCP_CACHE_TTL_MS, 300000),
    cacheMaxEntries: parseIntSafe(process.env.MCP_CACHE_MAX_ENTRIES, 1000),
    logLevel: (['debug', 'info', 'warn', 'error'].includes(process.env.MCP_LOG_LEVEL || '')
      ? process.env.MCP_LOG_LEVEL
      : 'info') as ServerConfig['logLevel'],
  };
}

export * from './types.js';
