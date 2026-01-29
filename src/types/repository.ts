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
  registeredAt: Date
}

export interface RepositoryFilter {
  tags?: string[]
}

export interface RegisterResult extends Repository {
  action: 'registered' | 'updated'
}
