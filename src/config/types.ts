export interface ServerConfig {
  configDir: string;
  maxSearchResults: number;
  maxFileSize: number;
  searchTimeout: number;
  cacheEnabled: boolean;
  cacheTtl: number;
  cacheMaxEntries: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface RepositoriesConfig {
  version: number;
  repositories: SerializedRepository[];
}

export interface SerializedRepository {
  id: string;
  path: string;
  alias?: string;
  tags: string[];
  gitInfo: {
    remote?: string;
    branch: string;
    lastCommit: string;
  };
  languages: string[];
  lastScanned: string;
  fileCount: number;
}
