import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, it, vi } from 'vitest'
import { registerApiTools } from './api-tools.js'
import { registerRepositoryTools } from './repository-tools.js'
import { registerSymbolTools } from './symbol-tools.js'

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
  registerTool: vi.fn(),
} as unknown as McpServer

describe('tool definitions', () => {
  it('should register repository tools with comma-separated string parameters', () => {
    registerRepositoryTools(mockServer, mockRepoManager as any)

    // Verify register_repository registration
    const regCall = (mockServer.registerTool as any).mock.calls.find((c: any) => c[0] === 'repolens_register_repository')
    expect(regCall).toBeDefined()
    // inputSchema is now a z.object(), so check .shape for field schemas
    expect(regCall[1].inputSchema.shape.tags).toBeDefined()
    expect(regCall[1].inputSchema.shape.force).toBeDefined()

    // Verify repositories tool registration
    const reposCall = (mockServer.registerTool as any).mock.calls.find((c: any) => c[0] === 'repolens_repositories')
    expect(reposCall).toBeDefined()
    expect(reposCall[1].inputSchema.shape.identifier).toBeDefined()
    expect(reposCall[1].inputSchema.shape.remove).toBeDefined()
    expect(reposCall[1].inputSchema.shape.tagFilter).toBeDefined()
  })

  it('should register exactly 2 repository tools', () => {
    const toolServer = {
      registerTool: vi.fn(),
    } as unknown as McpServer

    registerRepositoryTools(toolServer, mockRepoManager as any)

    expect(toolServer.registerTool).toHaveBeenCalledTimes(2)
    const toolNames = (toolServer.registerTool as any).mock.calls.map((c: any) => c[0])
    expect(toolNames).toContain('repolens_register_repository')
    expect(toolNames).toContain('repolens_repositories')
  })
})

describe('api tool definitions', () => {
  it('should use z.enum for method parameter', () => {
    const toolServer = {
      registerTool: vi.fn(),
    } as unknown as McpServer

    registerApiTools(toolServer, mockRepoManager as any, {} as any)

    const apiCall = (toolServer.registerTool as any).mock.calls.find((c: any) => c[0] === 'repolens_find_api_routes')
    expect(apiCall).toBeDefined()

    // The method field should be an enum, not a free-form string
    const methodSchema = apiCall[1].inputSchema.shape.method
    expect(methodSchema).toBeDefined()
    // z.enum().optional() wraps in optional -> innerType is the enum schema
    const inner = methodSchema._def.innerType || methodSchema
    expect(inner._def.type).toBe('enum')
    expect(inner._def.entries).toBeDefined()
  })

  it('should use z.enum for framework parameter', () => {
    const toolServer = {
      registerTool: vi.fn(),
    } as unknown as McpServer

    registerApiTools(toolServer, mockRepoManager as any, {} as any)

    const apiCall = (toolServer.registerTool as any).mock.calls.find((c: any) => c[0] === 'repolens_find_api_routes')
    expect(apiCall).toBeDefined()

    const frameworkSchema = apiCall[1].inputSchema.shape.framework
    expect(frameworkSchema).toBeDefined()
    const inner = frameworkSchema._def.innerType || frameworkSchema
    expect(inner._def.type).toBe('enum')
    expect(inner._def.entries).toBeDefined()
  })
})

describe('symbol tool definitions', () => {
  it('should use z.enum for language parameter in all symbol tools', () => {
    const toolServer = {
      registerTool: vi.fn(),
    } as unknown as McpServer

    registerSymbolTools(toolServer, mockRepoManager as any, {} as any)

    const toolNames = ['repolens_find_functions', 'repolens_find_classes', 'repolens_find_types']
    for (const toolName of toolNames) {
      const call = (toolServer.registerTool as any).mock.calls.find((c: any) => c[0] === toolName)
      expect(call, `${toolName} should be registered`).toBeDefined()

      const languageSchema = call[1].inputSchema.shape.language
      expect(languageSchema, `${toolName} should have language field`).toBeDefined()
      const inner = languageSchema._def.innerType || languageSchema
      expect(inner._def.type, `${toolName} language should be an enum`).toBe('enum')
      expect(inner._def.entries, `${toolName} language enum should have entries`).toBeDefined()
    }
  })

  it('should include php in language enum for all symbol tools', () => {
    const toolServer = {
      registerTool: vi.fn(),
    } as unknown as McpServer

    registerSymbolTools(toolServer, mockRepoManager as any, {} as any)

    const toolNames = ['repolens_find_functions', 'repolens_find_classes', 'repolens_find_types']
    for (const toolName of toolNames) {
      const call = (toolServer.registerTool as any).mock.calls.find((c: any) => c[0] === toolName)
      const languageSchema = call[1].inputSchema.shape.language
      const inner = languageSchema._def.innerType || languageSchema
      expect(inner._def.entries, `${toolName} should have entries`).toBeDefined()
      expect(inner._def.entries, `${toolName} should include php`).toHaveProperty('php')
    }
  })
})
