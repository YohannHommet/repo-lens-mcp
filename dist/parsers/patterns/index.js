import { TYPESCRIPT_PATTERNS, TYPESCRIPT_ARROW_FUNCTION_PATTERNS } from './typescript.js';
export const LANGUAGE_PATTERNS = {
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
export function getLanguageFromExtension(ext) {
    const map = {
        '.ts': 'typescript',
        '.tsx': 'tsx',
        '.js': 'javascript',
        '.jsx': 'jsx',
        '.mjs': 'javascript',
        '.cjs': 'javascript',
    };
    return map[ext] || null;
}
export function getSupportedExtensions() {
    return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
}
//# sourceMappingURL=index.js.map