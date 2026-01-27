import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { registerRepositoryTools } from './repository-tools.js'
import { registerSearchTools } from './search-tools.js'

// Mock dependencies
const mockRepoManager = {
  register: vi.fn(),
  unregister: vi.fn(),
  list: vi.fn(),
  resolveIdentifiers: vi.fn(),
}

const mockSearchCache = {
  clear: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  generateKey: vi.fn(),
}

const mockConfig = {
  cacheEnabled: true,
}

// Mock engines
const mockTextSearch = { search: vi.fn() }

// Mock McpServer
const mockServer = {
  tool: vi.fn(),
} as unknown as McpServer

describe('tool Definitions', () => {
  it('should register updated repository tools', () => {
    registerRepositoryTools(mockServer, mockRepoManager as any, mockSearchCache as any)

    // Verify list_registered_repositories registration
    const call = (mockServer.tool as any).mock.calls.find((c: any) => c[0] === 'list_registered_repositories')
    expect(call).toBeDefined()
    expect(call[2].tagFilter).toBeDefined()
    expect(call[2].tagFilter instanceof z.ZodString || call[2].tagFilter instanceof z.ZodOptional).toBeTruthy()

    // Verify register_repository uses string tags
    const regCall = (mockServer.tool as any).mock.calls.find((c: any) => c[0] === 'register_repository')
    expect(regCall).toBeDefined()
    expect(regCall[2].tags).toBeDefined()
  })

  it('should register updated search tools with string filters', () => {
    registerSearchTools(mockServer, mockRepoManager as any, mockTextSearch as any, mockSearchCache as any, mockConfig as any)

    const call = (mockServer.tool as any).mock.calls.find((c: any) => c[0] === 'search_text')
    expect(call).toBeDefined()
    expect(call[2].repoFilter).toBeDefined()
  })
})
