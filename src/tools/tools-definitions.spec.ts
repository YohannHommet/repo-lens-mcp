import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, it, vi } from 'vitest'
import { registerApiTools } from './api-tools.js'
import { registerRepositoryTools } from './repository-tools.js'
import { registerSymbolTools } from './symbol-tools.js'

// Mock dependencies
const mockRepoManager = {
  list: vi.fn(),
  get: vi.fn(),
  resolveIdentifiers: vi.fn(),
  createAdHocRepositories: vi.fn(),
}

// Mock McpServer
const mockServer = {
  registerTool: vi.fn(),
} as unknown as McpServer

describe('tool definitions', () => {
  it('should register exactly 1 repository tool', () => {
    const toolServer = {
      registerTool: vi.fn(),
    } as unknown as McpServer

    registerRepositoryTools(toolServer, mockRepoManager as any)

    expect(toolServer.registerTool).toHaveBeenCalledTimes(1)
    const toolNames = (toolServer.registerTool as any).mock.calls.map((c: any) => c[0])
    expect(toolNames).toContain('repolens_list_repositories')
  })

  it('should register list_repositories tool with response_format parameter only', () => {
    registerRepositoryTools(mockServer, mockRepoManager as any)

    const reposCall = (mockServer.registerTool as any).mock.calls.find((c: any) => c[0] === 'repolens_list_repositories')
    expect(reposCall).toBeDefined()
    expect(reposCall[1].inputSchema.shape.response_format).toBeDefined()
    // No add/alias/remove params
    expect(reposCall[1].inputSchema.shape.add).toBeUndefined()
    expect(reposCall[1].inputSchema.shape.alias).toBeUndefined()
    expect(reposCall[1].inputSchema.shape.remove).toBeUndefined()
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

  it('should have paths parameter on api routes tool', () => {
    const toolServer = {
      registerTool: vi.fn(),
    } as unknown as McpServer

    registerApiTools(toolServer, mockRepoManager as any, {} as any)

    const apiCall = (toolServer.registerTool as any).mock.calls.find((c: any) => c[0] === 'repolens_find_api_routes')
    expect(apiCall[1].inputSchema.shape.paths).toBeDefined()
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

  it('should have paths parameter on all symbol tools', () => {
    const toolServer = {
      registerTool: vi.fn(),
    } as unknown as McpServer

    registerSymbolTools(toolServer, mockRepoManager as any, {} as any)

    const toolNames = ['repolens_find_functions', 'repolens_find_classes', 'repolens_find_types']
    for (const toolName of toolNames) {
      const call = (toolServer.registerTool as any).mock.calls.find((c: any) => c[0] === toolName)
      expect(call[1].inputSchema.shape.paths, `${toolName} should have paths field`).toBeDefined()
    }
  })
})
