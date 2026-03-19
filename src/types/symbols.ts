export type SymbolKind
  = | 'function'
    | 'class'
    | 'interface'
    | 'type'
    | 'method'
    | 'variable'
    | 'enum'
    | 'constant'

export interface SymbolSearchOptions {
  kind?: SymbolKind
  kinds?: SymbolKind[]
  name?: string
  repositoryIds?: string[]
  language?: string
  exportedOnly?: boolean
  maxResults?: number
}

export interface SymbolResult {
  repository: string
  repositoryAlias?: string
  filePath: string
  relativePath: string
  name: string
  kind: SymbolKind
  startLine: number
  endLine: number
  signature?: string
  exported: boolean
  documentation?: string
}

export interface APIRoute {
  repository: string
  repositoryAlias?: string
  method: string
  path: string
  handler: string
  filePath: string
  relativePath: string
  lineNumber: number
  framework?: string
  middleware?: string[]
  parameters?: {
    path: string[]
    query: string[]
    body?: string
  }
  response?: string
}

export interface APIRouteSearchOptions {
  method?: string
  pathPattern?: string
  repos?: string[]
  framework?: string
  maxResults?: number
}
