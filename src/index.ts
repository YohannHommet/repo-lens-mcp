#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { loadConfig } from './config/index.js'
import { RepositoryManager } from './core/repository-manager.js'
import { APIRouteSearchEngine } from './search/api-route-search.js'
import { FileSearchEngine } from './search/file-search.js'
import { SymbolSearchEngine } from './search/symbol-search.js'
import { TextSearchEngine } from './search/text-search.js'
import {
  registerApiTools,
  registerFileTools,
  registerRepositoryTools,
  registerSearchTools,
  registerSymbolTools,
} from './tools/index.js'
import { SearchCache } from './utils/cache.js'
import { logger } from './utils/logger.js'

// Load configuration
const config = loadConfig()
logger.setLevel(config.logLevel)

// Initialize core components
const repoManager = new RepositoryManager(config.configDir)
const textSearch = new TextSearchEngine(config.searchTimeout)
const symbolSearch = new SymbolSearchEngine()
const fileSearch = new FileSearchEngine()
const apiRouteSearch = new APIRouteSearchEngine()

const searchCache = new SearchCache({
  maxSize: config.cacheMaxEntries,
  ttl: config.cacheTtl,
})

// Initialize MCP Server
const server = new McpServer({
  name: 'mcp-repo-search-server',
  version: '1.0.0',
})

// Register Tools
registerRepositoryTools(server, repoManager, searchCache)
registerSearchTools(server, repoManager, textSearch, searchCache, config)
registerSymbolTools(server, repoManager, symbolSearch, searchCache, config)
registerApiTools(server, repoManager, apiRouteSearch, searchCache, config)
registerFileTools(server, repoManager, fileSearch)

// ==================== Server Startup ====================

async function main(): Promise<void> {
  await repoManager.load()

  const transport = new StdioServerTransport()
  await server.connect(transport)

  logger.info('MCP Repo Search Server started', {
    configDir: config.configDir,
    repositoryCount: (await repoManager.list()).length,
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
