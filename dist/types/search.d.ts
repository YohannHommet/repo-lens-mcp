export interface TextSearchOptions {
    pattern: string;
    repositoryIds?: string[];
    glob?: string;
    caseSensitive?: boolean;
    wholeWord?: boolean;
    maxResults?: number;
    contextLines?: number;
}
export interface TextSearchResult {
    repository: string;
    repositoryAlias?: string;
    filePath: string;
    relativePath: string;
    lineNumber: number;
    columnNumber: number;
    lineContent: string;
    beforeContext?: string[];
    afterContext?: string[];
}
export interface FileSearchOptions {
    pattern: string;
    repositoryIds?: string[];
    maxResults?: number;
}
export interface FileSearchResult {
    repository: string;
    repositoryAlias?: string;
    filePath: string;
    relativePath: string;
}
//# sourceMappingURL=search.d.ts.map