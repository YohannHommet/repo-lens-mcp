export interface GitInfo {
  remote?: string
  branch: string
  lastCommit: string
}

export interface Repository {
  id: string
  path: string
  alias?: string
  gitInfo: GitInfo
  registeredAt: Date
}
