/**
 * Shared constants used across the MCP server
 */

/**
 * Patterns to ignore for symbol search (generated/minified files)
 */
export const SYMBOL_SEARCH_IGNORE_PATTERNS = [
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
  '**/*.d.ts',
  '**/*.min.js',
  '**/*.bundle.js',
  '**/*.generated.*',
]

/**
 * Supported languages for AST parsing
 * Only includes languages with actual ast-grep support
 */
export enum SupportedLanguage {
  TypeScript = 'typescript',
  JavaScript = 'javascript',
  PHP = 'php',
}

/**
 * Language extensions mapping for supported languages
 */
const LANGUAGE_EXTENSIONS: Record<SupportedLanguage, string[]> = {
  [SupportedLanguage.TypeScript]: ['.ts', '.tsx'],
  [SupportedLanguage.JavaScript]: ['.js', '.jsx', '.mjs', '.cjs'],
  [SupportedLanguage.PHP]: ['.php'],
}

/**
 * Get language from file extension
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
