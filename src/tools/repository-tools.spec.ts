import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerRepositoryTools } from './repository-tools.js'

// Mock repository data
const mockRepo = {
  id: 'repo-123',
  path: '/projects/my-app',
  alias: 'my-app',
  tags: ['frontend', 'typescript'],
  gitInfo: { branch: 'main', lastCommit: 'abc123' },
  registeredAt: new Date('2026-01-01'),
  action: 'registered' as const,
}

const mockUpdatedRepo = {
  ...mockRepo,
  action: 'updated' as const,
}

// Capture registered tool handlers
type ToolHandler = (args: any) => Promise<any>
const toolHandlers: Map<string, ToolHandler> = new Map()

const mockServer = {
  tool: vi.fn((name: string, _description: string, _schema: any, handler: ToolHandler) => {
    toolHandlers.set(name, handler)
  }),
} as unknown as McpServer

describe('repository tools', () => {
  let mockRepoManager: any

  beforeEach(() => {
    toolHandlers.clear()
    vi.clearAllMocks()

    mockRepoManager = {
      register: vi.fn(),
      unregister: vi.fn(),
      list: vi.fn(),
      get: vi.fn(),
    }

    registerRepositoryTools(mockServer, mockRepoManager)
  })

  describe('register_repository', () => {
    it('should register a new repository successfully', async () => {
      // Arrange
      mockRepoManager.register.mockResolvedValue(mockRepo)
      const handler = toolHandlers.get('register_repository')!

      // Act
      const result = await handler({
        path: '/projects/my-app',
        alias: 'my-app',
        tags: 'frontend,typescript',
      })

      // Assert
      expect(mockRepoManager.register).toHaveBeenCalledWith(
        '/projects/my-app',
        { alias: 'my-app', tags: ['frontend', 'typescript'], force: undefined },
      )
      expect(result.isError).toBeUndefined()
      const content = JSON.parse(result.content[0].text)
      expect(content.success).toBe(true)
      expect(content.action).toBe('registered')
      expect(content.repository.id).toBe('repo-123')
    })

    it('should update existing repository with force=true', async () => {
      // Arrange
      mockRepoManager.register.mockResolvedValue(mockUpdatedRepo)
      const handler = toolHandlers.get('register_repository')!

      // Act
      const result = await handler({
        path: '/projects/my-app',
        force: true,
      })

      // Assert
      expect(mockRepoManager.register).toHaveBeenCalledWith(
        '/projects/my-app',
        { alias: undefined, tags: [], force: true },
      )
      const content = JSON.parse(result.content[0].text)
      expect(content.action).toBe('updated')
    })

    it('should handle registration errors', async () => {
      // Arrange
      mockRepoManager.register.mockRejectedValue(new Error('Repository already registered'))
      const handler = toolHandlers.get('register_repository')!

      // Act
      const result = await handler({ path: '/projects/my-app' })

      // Assert
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Repository already registered')
    })

    it('should handle undefined tags gracefully', async () => {
      // Arrange
      mockRepoManager.register.mockResolvedValue(mockRepo)
      const handler = toolHandlers.get('register_repository')!

      // Act
      await handler({ path: '/projects/my-app' })

      // Assert
      expect(mockRepoManager.register).toHaveBeenCalledWith(
        '/projects/my-app',
        { alias: undefined, tags: [], force: undefined },
      )
    })
  })

  describe('repositories - list mode', () => {
    it('should list all repositories', async () => {
      // Arrange
      mockRepoManager.list.mockResolvedValue([mockRepo])
      const handler = toolHandlers.get('repositories')!

      // Act
      const result = await handler({})

      // Assert
      expect(mockRepoManager.list).toHaveBeenCalledWith({ tags: undefined })
      expect(result.content[0].text).toContain('Registered Repositories (1)')
      expect(result.content[0].text).toContain('my-app')
    })

    it('should filter repositories by tags', async () => {
      // Arrange
      mockRepoManager.list.mockResolvedValue([mockRepo])
      const handler = toolHandlers.get('repositories')!

      // Act
      const result = await handler({ tagFilter: 'frontend,typescript' })

      // Assert
      expect(mockRepoManager.list).toHaveBeenCalledWith({ tags: ['frontend', 'typescript'] })
      expect(result.content[0].text).toContain('my-app')
    })

    it('should handle empty repository list', async () => {
      // Arrange
      mockRepoManager.list.mockResolvedValue([])
      const handler = toolHandlers.get('repositories')!

      // Act
      const result = await handler({})

      // Assert
      expect(result.content[0].text).toBe('No repositories registered.')
    })

    it('should display repository without alias using id', async () => {
      // Arrange
      const repoWithoutAlias = { ...mockRepo, alias: undefined }
      mockRepoManager.list.mockResolvedValue([repoWithoutAlias])
      const handler = toolHandlers.get('repositories')!

      // Act
      const result = await handler({})

      // Assert
      expect(result.content[0].text).toContain('repo-123')
    })

    it('should display repository without tags', async () => {
      // Arrange
      const repoWithoutTags = { ...mockRepo, tags: [] }
      mockRepoManager.list.mockResolvedValue([repoWithoutTags])
      const handler = toolHandlers.get('repositories')!

      // Act
      const result = await handler({})

      // Assert
      expect(result.content[0].text).not.toContain('**Tags**')
    })
  })

  describe('repositories - get mode', () => {
    it('should get repository by identifier', async () => {
      // Arrange
      mockRepoManager.get.mockResolvedValue(mockRepo)
      const handler = toolHandlers.get('repositories')!

      // Act
      const result = await handler({ identifier: 'my-app' })

      // Assert
      expect(mockRepoManager.get).toHaveBeenCalledWith('my-app')
      const content = JSON.parse(result.content[0].text)
      expect(content.id).toBe('repo-123')
      expect(content.alias).toBe('my-app')
    })

    it('should return error when repository not found', async () => {
      // Arrange
      mockRepoManager.get.mockResolvedValue(null)
      const handler = toolHandlers.get('repositories')!

      // Act
      const result = await handler({ identifier: 'nonexistent' })

      // Assert
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toBe('Repository not found')
    })
  })

  describe('repositories - remove mode', () => {
    it('should remove repository by identifier', async () => {
      // Arrange
      mockRepoManager.unregister.mockResolvedValue(undefined)
      const handler = toolHandlers.get('repositories')!

      // Act
      const result = await handler({ identifier: 'my-app', remove: true })

      // Assert
      expect(mockRepoManager.unregister).toHaveBeenCalledWith('my-app')
      const content = JSON.parse(result.content[0].text)
      expect(content.success).toBe(true)
      expect(content.removed).toBe('my-app')
    })

    it('should return error when remove=true but no identifier', async () => {
      // Arrange
      const handler = toolHandlers.get('repositories')!

      // Act
      const result = await handler({ remove: true })

      // Assert
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('requires an "identifier"')
      expect(mockRepoManager.unregister).not.toHaveBeenCalled()
    })

    it('should handle unregister errors', async () => {
      // Arrange
      mockRepoManager.unregister.mockRejectedValue(new Error('Repository not found: xyz'))
      const handler = toolHandlers.get('repositories')!

      // Act
      const result = await handler({ identifier: 'xyz', remove: true })

      // Assert
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Repository not found: xyz')
    })
  })

  describe('error handling', () => {
    it('should handle list errors', async () => {
      // Arrange
      mockRepoManager.list.mockRejectedValue(new Error('Database error'))
      const handler = toolHandlers.get('repositories')!

      // Act
      const result = await handler({})

      // Assert
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Database error')
    })

    it('should handle get errors', async () => {
      // Arrange
      mockRepoManager.get.mockRejectedValue(new Error('Connection failed'))
      const handler = toolHandlers.get('repositories')!

      // Act
      const result = await handler({ identifier: 'my-app' })

      // Assert
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Connection failed')
    })
  })
})
