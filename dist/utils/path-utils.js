import { resolve, relative, isAbsolute } from 'path';
import { existsSync, statSync, realpathSync } from 'fs';
export function normalizePath(path) {
    return resolve(path);
}
/**
 * Safely resolve a path, following symlinks to get the real path.
 * Falls back to resolve() if the path doesn't exist yet.
 */
export function safeRealPath(path) {
    try {
        return realpathSync(path);
    }
    catch {
        // Path doesn't exist, fall back to resolve
        return resolve(path);
    }
}
export function isValidDirectory(path) {
    try {
        return existsSync(path) && statSync(path).isDirectory();
    }
    catch {
        return false;
    }
}
export function isValidFile(path) {
    try {
        return existsSync(path) && statSync(path).isFile();
    }
    catch {
        return false;
    }
}
export function getRelativePath(basePath, filePath) {
    return relative(basePath, filePath);
}
/**
 * Check if child path is within parent path.
 * Uses realpath to resolve symlinks and prevent path traversal attacks.
 */
export function isSubPath(parent, child) {
    try {
        // Resolve symlinks to get actual paths
        const realParent = safeRealPath(parent);
        const realChild = safeRealPath(child);
        const rel = relative(realParent, realChild);
        return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=path-utils.js.map