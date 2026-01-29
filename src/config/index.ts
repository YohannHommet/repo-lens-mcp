import type { ServerConfig } from './types.js'
import { homedir } from 'node:os'
import { join } from 'node:path'

export function loadConfig(): ServerConfig {
  const configDir
    = process.env.MCP_REPO_SEARCH_CONFIG_DIR?.replace('~', homedir())
      || join(homedir(), '.config', 'mcp-repo-search')

  return {
    configDir,
    logLevel: (['debug', 'info', 'warn', 'error'].includes(process.env.MCP_LOG_LEVEL || '')
      ? process.env.MCP_LOG_LEVEL
      : 'info') as ServerConfig['logLevel'],
  }
}

export * from './types.js'
