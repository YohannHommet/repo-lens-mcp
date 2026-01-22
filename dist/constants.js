/**
 * Shared constants used across the MCP server
 */
/**
 * Default directories to ignore when scanning repositories
 */
export const DEFAULT_IGNORE_PATTERNS = [
    '**/node_modules/**',
    '**/vendor/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/.nuxt/**',
    '**/coverage/**',
    '**/__pycache__/**',
    '**/.venv/**',
    '**/venv/**',
];
/**
 * Additional patterns to ignore for symbol search (generated/minified files)
 */
export const SYMBOL_SEARCH_IGNORE_PATTERNS = [
    ...DEFAULT_IGNORE_PATTERNS,
    '**/*.d.ts',
    '**/*.min.js',
    '**/*.bundle.js',
    '**/*.generated.*',
];
/**
 * Language extensions mapping
 */
export const LANGUAGE_EXTENSIONS = {
    typescript: ['.ts', '.tsx'],
    javascript: ['.js', '.jsx', '.mjs', '.cjs'],
    python: ['.py'],
    php: ['.php'],
    go: ['.go'],
    rust: ['.rs'],
    java: ['.java'],
    csharp: ['.cs'],
    ruby: ['.rb'],
    vue: ['.vue'],
    svelte: ['.svelte'],
    css: ['.css'],
    scss: ['.scss'],
    less: ['.less'],
    html: ['.html'],
    json: ['.json'],
    yaml: ['.yaml', '.yml'],
    markdown: ['.md'],
    sql: ['.sql'],
};
/**
 * Get language name from file extension
 */
export function getLanguageFromExtension(ext) {
    const normalizedExt = ext.toLowerCase();
    for (const [lang, extensions] of Object.entries(LANGUAGE_EXTENSIONS)) {
        if (extensions.includes(normalizedExt)) {
            return lang;
        }
    }
    return undefined;
}
/**
 * Default search timeout in milliseconds
 */
export const DEFAULT_SEARCH_TIMEOUT_MS = 30000;
/**
 * Default maximum search results
 */
export const DEFAULT_MAX_RESULTS = 500;
/**
 * Maximum file size to read (10 MB)
 */
export const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;
//# sourceMappingURL=constants.js.map