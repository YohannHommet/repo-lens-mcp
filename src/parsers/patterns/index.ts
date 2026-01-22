import { TYPESCRIPT_PATTERNS, TYPESCRIPT_ARROW_FUNCTION_PATTERNS } from './typescript.js';
import type { SymbolKind } from '../../types/symbols.js';

export interface LanguagePatterns {
  patterns: Partial<Record<SymbolKind, string[]>>;
  arrowFunctions?: string[];
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
};

export function getLanguageFromExtension(ext: string): string | null {
  const map: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'tsx',
    '.js': 'javascript',
    '.jsx': 'jsx',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
  };
  return map[ext] || null;
}

export function getSupportedExtensions(): string[] {
  return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
}
