import type { SymbolKind } from '../../types/symbols.js'
import { PHP_PATTERNS } from './php.js'
import { TYPESCRIPT_ARROW_FUNCTION_PATTERNS, TYPESCRIPT_PATTERNS } from './typescript.js'

/**
 * A search pattern can be a string (ast-grep pattern syntax) or a rule object
 * (kind-based matching). Rule objects are needed for languages like PHP where
 * the tree-sitter grammar doesn't support pattern string matching.
 */
export type SearchPattern = string | {
  rule: Record<string, unknown>
  /** AST kind of the child node that contains the symbol name */
  nameChildKind?: string
}

export interface LanguagePatterns {
  patterns: Partial<Record<SymbolKind, SearchPattern[]>>
  arrowFunctions?: SearchPattern[]
}

export const LANGUAGE_PATTERNS: Record<string, LanguagePatterns> = {
  typescript: {
    patterns: TYPESCRIPT_PATTERNS,
    arrowFunctions: TYPESCRIPT_ARROW_FUNCTION_PATTERNS,
  },
  javascript: {
    patterns: TYPESCRIPT_PATTERNS, // JS uses same patterns
    arrowFunctions: TYPESCRIPT_ARROW_FUNCTION_PATTERNS,
  },
  tsx: {
    patterns: TYPESCRIPT_PATTERNS,
    arrowFunctions: TYPESCRIPT_ARROW_FUNCTION_PATTERNS,
  },
  jsx: {
    patterns: TYPESCRIPT_PATTERNS,
    arrowFunctions: TYPESCRIPT_ARROW_FUNCTION_PATTERNS,
  },
  php: {
    patterns: PHP_PATTERNS,
  },
}
