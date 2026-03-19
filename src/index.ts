#!/usr/bin/env node

import phpLang from '@ast-grep/lang-php'
import { registerDynamicLanguage } from '@ast-grep/napi'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { loadConfig } from './config/index.js'
import { ConfigLoader } from './core/config-loader.js'
import { RepositoryManager } from './core/repository-manager.js'
import { APIRouteSearchEngine } from './search/api-route-search.js'
import { SymbolSearchEngine } from './search/symbol-search.js'
import {
  registerApiTools,
  registerRepositoryTools,
  registerSymbolTools,
} from './tools/index.js'
import { logger } from './utils/logger.js'

// Register PHP as a dynamic language for ast-grep
// phpLang uses a lazy getter for libraryPath — runtime-compatible but types diverge
registerDynamicLanguage({ php: phpLang } as any)

// Load configuration
const config = loadConfig()
logger.setLevel(config.logLevel)

// Initialize core components
const configLoader = new ConfigLoader(config.configFilePath)
const repoManager = new RepositoryManager(configLoader)
const symbolSearch = new SymbolSearchEngine()
const apiRouteSearch = new APIRouteSearchEngine()

// Initialize MCP Server
const server = new McpServer({
  name: 'repo-lens-mcp',
  version: '0.3.0',
})

// Register Tools
registerRepositoryTools(server, repoManager)
registerSymbolTools(server, repoManager, symbolSearch)
registerApiTools(server, repoManager, apiRouteSearch)

// ==================== Server Startup ====================

async function main(): Promise<void> {
  await repoManager.load()

  const transport = new StdioServerTransport()
  await server.connect(transport)

  logger.info('MCP Repo Lens Server started', {
    configFile: config.configFilePath,
    repositoryCount: repoManager.list().length,
  })
}

let isShuttingDown = false

async function shutdown(signal: string) {
  if (isShuttingDown)
    return
  isShuttingDown = true

  logger.info(`Received ${signal}, shutting down gracefully...`)
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

main().catch((error) => {
  logger.error('Fatal error', { error })
  process.exit(1)
})
