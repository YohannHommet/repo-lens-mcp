export declare function normalizePath(path: string): string;
/**
 * Safely resolve a path, following symlinks to get the real path.
 * Falls back to resolve() if the path doesn't exist yet.
 */
export declare function safeRealPath(path: string): string;
export declare function isValidDirectory(path: string): boolean;
export declare function isValidFile(path: string): boolean;
export declare function getRelativePath(basePath: string, filePath: string): string;
/**
 * Check if child path is within parent path.
 * Uses realpath to resolve symlinks and prevent path traversal attacks.
 */
export declare function isSubPath(parent: string, child: string): boolean;
//# sourceMappingURL=path-utils.d.ts.map