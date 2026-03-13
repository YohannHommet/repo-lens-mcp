#!/usr/bin/env node

import phpLang from '@ast-grep/lang-php'
import { registerDynamicLanguage } from '@ast-grep/napi'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { loadConfig } from './config/index.js'
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
registerDynamicLanguage({ php: phpLang })

// Load configuration
const config = loadConfig()
logger.setLevel(config.logLevel)

// Initialize core components
const repoManager = new RepositoryManager(config.configDir)
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

  logger.info('MCP Repo Search Server started', {
    configDir: config.configDir,
    repositoryCount: repoManager.list().length,
  })
}

let isShuttingDown = false

async function shutdown(signal: string) {
  if (isShuttingDown)
    return
  isShuttingDown = true

  logger.info(`Received ${signal}, shutting down gracefully...`)

  try {
    // No explicit save needed as operations persist immediately
    logger.info('Shutting down...')
  }
  catch (error) {
    logger.error('Error during shutdown', { error })
  }

  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

main().catch((error) => {
  logger.error('Fatal error', { error })
  process.exit(1)
})
