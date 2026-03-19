import type { ServerConfig } from './types.js'
import { homedir } from 'node:os'
import { join } from 'node:path'

function parseConfigArg(): string | null {
  const idx = process.argv.indexOf('--config')
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1].replace('~', homedir())
  }
  return null
}

export function loadConfig(): ServerConfig {
  const explicitPath = parseConfigArg()
  const defaultPath = join(homedir(), '.config', 'repo-lens-mcp', 'repolens.yaml')
  const configFilePath = explicitPath ?? defaultPath

  return {
    configFilePath,
    logLevel: (['debug', 'info', 'warn', 'error'].includes(process.env.MCP_LOG_LEVEL || '')
      ? process.env.MCP_LOG_LEVEL
      : 'info') as ServerConfig['logLevel'],
  }
}

export * from './types.js'
