import { homedir } from 'os';
import { join } from 'path';
import type { ServerConfig } from './types.js';

export function loadConfig(): ServerConfig {
  const configDir =
    process.env.MCP_REPO_SEARCH_CONFIG_DIR?.replace('~', homedir()) ||
    join(homedir(), '.config', 'mcp-repo-search');

  return {
    configDir,
    maxSearchResults: parseInt(process.env.MCP_MAX_SEARCH_RESULTS || '500', 10),
    maxFileSize: parseInt(process.env.MCP_MAX_FILE_SIZE_MB || '10', 10) * 1024 * 1024,
    searchTimeout: parseInt(process.env.MCP_SEARCH_TIMEOUT_MS || '30000', 10),
    cacheEnabled: process.env.MCP_CACHE_ENABLED !== 'false',
    cacheTtl: parseInt(process.env.MCP_CACHE_TTL_MS || '300000', 10),
    cacheMaxEntries: parseInt(process.env.MCP_CACHE_MAX_ENTRIES || '1000', 10),
    logLevel: (process.env.MCP_LOG_LEVEL || 'info') as ServerConfig['logLevel'],
  };
}

export * from './types.js';
