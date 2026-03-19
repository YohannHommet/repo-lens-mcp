import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerRepositoryTools } from './repository-tools.js'

// Mock repository data
const mockRepo = {
  id: 'repo-123',
  path: '/projects/my-app',
  alias: 'my-app',
  gitInfo: { branch: 'main', lastCommit: 'abc123' },
  registeredAt: new Date('2026-01-01'),
}

const mockRepoNoAlias = {
  id: 'repo-456',
  path: '/projects/backend-service',
  gitInfo: { branch: 'develop', lastCommit: 'def456' },
  registeredAt: new Date('2026-01-02'),
}

// Capture registered tool handlers
type ToolHandler = (args: any) => Promise<any>
const toolHandlers: Map<string, ToolHandler> = new Map()

const mockServer = {
  registerTool: vi.fn((name: string, _config: any, handler: ToolHandler) => {
    toolHandlers.set(name, handler)
  }),
} as unknown as McpServer

describe('repository tools', () => {
  let mockRepoManager: any

  beforeEach(() => {
    toolHandlers.clear()
    vi.clearAllMocks()

    mockRepoManager = {
      list: vi.fn(),
    }

    registerRepositoryTools(mockServer, mockRepoManager)
  })

  it('should register exactly one tool', () => {
    expect(mockServer.registerTool).toHaveBeenCalledTimes(1)
    expect(toolHandlers.has('repolens_list_repositories')).toBe(true)
  })

  describe('list mode', () => {
    it('should list all repositories', async () => {
      mockRepoManager.list.mockReturnValue([mockRepo])
      const handler = toolHandlers.get('repolens_list_repositories')!

      const result = await handler({})

      expect(mockRepoManager.list).toHaveBeenCalledWith()
      expect(result.content[0].text).toContain('1 repositories:')
      expect(result.content[0].text).toContain('my-app')
      expect(result.content[0].text).toContain('/projects/my-app')
      expect(result.content[0].text).toContain('main')
    })

    it('should handle empty list', async () => {
      mockRepoManager.list.mockReturnValue([])
      const handler = toolHandlers.get('repolens_list_repositories')!

      const result = await handler({})

      expect(result.content[0].text).toContain('No repositories configured')
    })

    it('should display alias in listing', async () => {
      mockRepoManager.list.mockReturnValue([mockRepo])
      const handler = toolHandlers.get('repolens_list_repositories')!

      const result = await handler({})

      expect(result.content[0].text).toContain('my-app: /projects/my-app (main)')
    })

    it('should display dir name when no alias', async () => {
      mockRepoManager.list.mockReturnValue([mockRepoNoAlias])
      const handler = toolHandlers.get('repolens_list_repositories')!

      const result = await handler({})

      expect(result.content[0].text).toContain('backend-service: /projects/backend-service (develop)')
    })
  })

  describe('response_format', () => {
    it('should return JSON when response_format=json', async () => {
      mockRepoManager.list.mockReturnValue([mockRepo, mockRepoNoAlias])
      const handler = toolHandlers.get('repolens_list_repositories')!

      const result = await handler({ response_format: 'json' })

      const content = JSON.parse(result.content[0].text)
      expect(Array.isArray(content)).toBe(true)
      expect(content).toHaveLength(2)
      expect(content[0].id).toBe('repo-123')
      expect(content[1].id).toBe('repo-456')
    })

    it('should return JSON empty array when response_format=json and no repos', async () => {
      mockRepoManager.list.mockReturnValue([])
      const handler = toolHandlers.get('repolens_list_repositories')!

      const result = await handler({ response_format: 'json' })

      expect(result.content[0].text).toBe('[]')
    })
  })

  describe('error handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      mockRepoManager.list.mockImplementation(() => {
        throw new Error('Database error')
      })
      const handler = toolHandlers.get('repolens_list_repositories')!

      const result = await handler({})

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Error: Database error')
    })
  })
})
