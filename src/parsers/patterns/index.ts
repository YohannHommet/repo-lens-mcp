import type { SymbolKind } from '../../types/symbols.js'
import { TYPESCRIPT_ARROW_FUNCTION_PATTERNS, TYPESCRIPT_PATTERNS } from './typescript.js'

export interface LanguagePatterns {
  patterns: Partial<Record<SymbolKind, string[]>>
  arrowFunctions?: string[]
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
}
