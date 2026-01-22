import { Lang } from '@ast-grep/napi';
import { extname } from 'path';
const EXTENSION_TO_LANG = {
    '.ts': Lang.TypeScript,
    '.tsx': Lang.Tsx,
    '.js': Lang.JavaScript,
    '.jsx': Lang.JavaScript,
    '.mjs': Lang.JavaScript,
    '.cjs': Lang.JavaScript,
};
const EXTENSION_TO_LANG_NAME = {
    '.ts': 'typescript',
    '.tsx': 'tsx',
    '.js': 'javascript',
    '.jsx': 'jsx',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
};
export function getLangFromFile(filePath) {
    const ext = extname(filePath).toLowerCase();
    return EXTENSION_TO_LANG[ext] || null;
}
export function getLangNameFromFile(filePath) {
    const ext = extname(filePath).toLowerCase();
    return EXTENSION_TO_LANG_NAME[ext] || null;
}
export function isSupportedFile(filePath) {
    const ext = extname(filePath).toLowerCase();
    return ext in EXTENSION_TO_LANG;
}
export function getSupportedExtensions() {
    return Object.keys(EXTENSION_TO_LANG);
}
//# sourceMappingURL=language-registry.js.map