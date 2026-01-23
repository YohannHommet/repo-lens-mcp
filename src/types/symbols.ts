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
  kind: SymbolKind
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
  method: string // GET, POST, PUT, DELETE, etc.
  path: string // /api/users/:id
  handler: string // Function name handling the route
  filePath: string // Absolute path
  relativePath: string // Relative to repo
  lineNumber: number // Line where route is defined
  framework?: string // express, fastify, nestjs, etc.
  middleware?: string[] // Middleware names
  parameters?: {
    path: string[] // Route params like :id, :userId
    query: string[] // Query params
    body?: string // Request body type
  }
  response?: string // Response type
}

export interface APIRouteSearchOptions {
  method?: string // Filter by HTTP method
  pathPattern?: string // Filter by path pattern
  repos?: string[] // Repository identifiers
  framework?: string // express, fastify, nestjs
  maxResults?: number
}
