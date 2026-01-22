import type { Repository } from '../types/repository.js';
import type { FileSearchOptions, FileSearchResult } from '../types/search.js';
export interface FileInfo {
    filePath: string;
    relativePath: string;
    size: number;
    modified: Date;
    language?: string;
}
export declare class FileSearchEngine {
    search(options: FileSearchOptions, repositories: Repository[]): Promise<FileSearchResult[]>;
    private searchInRepo;
    listFiles(repo: Repository, path?: string, glob?: string, recursive?: boolean): Promise<FileSearchResult[]>;
    getFile(repo: Repository, filePath: string, startLine?: number, endLine?: number): Promise<{
        content: string;
        totalLines: number;
    }>;
    getFileInfo(repo: Repository, filePath: string): Promise<FileInfo>;
}
//# sourceMappingURL=file-search.d.ts.map