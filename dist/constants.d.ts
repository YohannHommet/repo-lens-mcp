/**
 * Shared constants used across the MCP server
 */
/**
 * Default directories to ignore when scanning repositories
 */
export declare const DEFAULT_IGNORE_PATTERNS: string[];
/**
 * Additional patterns to ignore for symbol search (generated/minified files)
 */
export declare const SYMBOL_SEARCH_IGNORE_PATTERNS: string[];
/**
 * Language extensions mapping
 */
export declare const LANGUAGE_EXTENSIONS: Record<string, string[]>;
/**
 * Get language name from file extension
 */
export declare function getLanguageFromExtension(ext: string): string | undefined;
/**
 * Default search timeout in milliseconds
 */
export declare const DEFAULT_SEARCH_TIMEOUT_MS = 30000;
/**
 * Default maximum search results
 */
export declare const DEFAULT_MAX_RESULTS = 500;
/**
 * Maximum file size to read (10 MB)
 */
export declare const DEFAULT_MAX_FILE_SIZE: number;
//# sourceMappingURL=constants.d.ts.map