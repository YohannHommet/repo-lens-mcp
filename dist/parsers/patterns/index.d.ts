import type { SymbolKind } from '../../types/symbols.js';
export interface LanguagePatterns {
    patterns: Partial<Record<SymbolKind, string[]>>;
    arrowFunctions?: string[];
}
export declare const LANGUAGE_PATTERNS: Record<string, LanguagePatterns>;
export declare function getLanguageFromExtension(ext: string): string | null;
export declare function getSupportedExtensions(): string[];
//# sourceMappingURL=index.d.ts.map