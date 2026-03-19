export interface ServerConfig {
  configFilePath: string | null
  logLevel: 'debug' | 'info' | 'warn' | 'error'
}

export interface RepoConfigEntry {
  path: string
  alias?: string
}

export interface RepoConfig {
  repositories: RepoConfigEntry[]
}
