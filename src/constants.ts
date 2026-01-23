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
]

/**
 * Additional patterns to ignore for symbol search (generated/minified files)
 */
export const SYMBOL_SEARCH_IGNORE_PATTERNS = [
  ...DEFAULT_IGNORE_PATTERNS,
  '**/*.d.ts',
  '**/*.min.js',
  '**/*.bundle.js',
  '**/*.generated.*',
]

/**
 * Supported languages enum for strict typing
 */
export enum SupportedLanguage {
  TypeScript = 'typescript',
  JavaScript = 'javascript',
  Python = 'python',
  PHP = 'php',
  Go = 'go',
  Rust = 'rust',
  Java = 'java',
  CSharp = 'csharp',
  Ruby = 'ruby',
  Vue = 'vue',
  Svelte = 'svelte',
  CSS = 'css',
  SCSS = 'scss',
  LESS = 'less',
  HTML = 'html',
  JSON = 'json',
  YAML = 'yaml',
  Markdown = 'markdown',
  SQL = 'sql',
}

/**
 * Language extensions mapping
 */
export const LANGUAGE_EXTENSIONS: Record<SupportedLanguage, string[]> = {
  [SupportedLanguage.TypeScript]: ['.ts', '.tsx'],
  [SupportedLanguage.JavaScript]: ['.js', '.jsx', '.mjs', '.cjs'],
  [SupportedLanguage.Python]: ['.py'],
  [SupportedLanguage.PHP]: ['.php'],
  [SupportedLanguage.Go]: ['.go'],
  [SupportedLanguage.Rust]: ['.rs'],
  [SupportedLanguage.Java]: ['.java'],
  [SupportedLanguage.CSharp]: ['.cs'],
  [SupportedLanguage.Ruby]: ['.rb'],
  [SupportedLanguage.Vue]: ['.vue'],
  [SupportedLanguage.Svelte]: ['.svelte'],
  [SupportedLanguage.CSS]: ['.css'],
  [SupportedLanguage.SCSS]: ['.scss'],
  [SupportedLanguage.LESS]: ['.less'],
  [SupportedLanguage.HTML]: ['.html'],
  [SupportedLanguage.JSON]: ['.json'],
  [SupportedLanguage.YAML]: ['.yaml', '.yml'],
  [SupportedLanguage.Markdown]: ['.md'],
  [SupportedLanguage.SQL]: ['.sql'],
}

/**
 * Get language name from file extension
 */
export function getLanguageFromExtension(ext: string): SupportedLanguage | undefined {
  const normalizedExt = ext.toLowerCase()
  for (const [lang, extensions] of Object.entries(LANGUAGE_EXTENSIONS)) {
    if (extensions.includes(normalizedExt)) {
      return lang as SupportedLanguage
    }
  }
  return undefined
}

/**
 * Default search timeout in milliseconds
 */
export const DEFAULT_SEARCH_TIMEOUT_MS = 30000

/**
 * Default maximum search results
 */
export const DEFAULT_MAX_RESULTS = 500

/**
 * Maximum file size to read (10 MB)
 */
export const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024
