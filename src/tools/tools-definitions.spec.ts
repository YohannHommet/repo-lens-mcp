import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, it, vi } from 'vitest'
import { registerRepositoryTools } from './repository-tools.js'

// Mock dependencies
const mockRepoManager = {
  register: vi.fn(),
  unregister: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  resolveIdentifiers: vi.fn(),
}

// Mock McpServer
const mockServer = {
  tool: vi.fn(),
} as unknown as McpServer

describe('tool definitions', () => {
  it('should register repository tools with comma-separated string parameters', () => {
    registerRepositoryTools(mockServer, mockRepoManager as any)

    // Verify register_repository registration
    const regCall = (mockServer.tool as any).mock.calls.find((c: any) => c[0] === 'register_repository')
    expect(regCall).toBeDefined()
    expect(regCall[2].tags).toBeDefined()
    expect(regCall[2].force).toBeDefined()

    // Verify repositories tool registration
    const reposCall = (mockServer.tool as any).mock.calls.find((c: any) => c[0] === 'repositories')
    expect(reposCall).toBeDefined()
    expect(reposCall[2].identifier).toBeDefined()
    expect(reposCall[2].remove).toBeDefined()
    expect(reposCall[2].tagFilter).toBeDefined()
  })

  it('should register exactly 2 repository tools', () => {
    const toolServer = {
      tool: vi.fn(),
    } as unknown as McpServer

    registerRepositoryTools(toolServer, mockRepoManager as any)

    expect(toolServer.tool).toHaveBeenCalledTimes(2)
    const toolNames = (toolServer.tool as any).mock.calls.map((c: any) => c[0])
    expect(toolNames).toContain('register_repository')
    expect(toolNames).toContain('repositories')
  })
})
