export interface GitInfo {
  remote?: string
  branch: string
  lastCommit: string
}

export interface Repository {
  id: string
  path: string
  alias?: string
  tags: string[]
  gitInfo: GitInfo
  languages: string[]
  lastScanned: Date
  fileCount: number
}

export interface RegisterOptions {
  alias?: string
  tags?: string[]
}

export interface RepositoryFilter {
  tags?: string[]
}
