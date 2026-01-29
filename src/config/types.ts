export interface ServerConfig {
  configDir: string
  logLevel: 'debug' | 'info' | 'warn' | 'error'
}

export interface RepositoriesConfig {
  version: number
  repositories: SerializedRepository[]
}

export interface SerializedRepository {
  id: string
  path: string
  alias?: string
  tags: string[]
  gitInfo: {
    remote?: string
    branch: string
    lastCommit: string
  }
  registeredAt: string
}
