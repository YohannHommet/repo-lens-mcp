import { resolve, relative, isAbsolute } from 'path';
import { existsSync, statSync, realpathSync } from 'fs';

export function normalizePath(path: string): string {
  return resolve(path);
}

/**
 * Safely resolve a path, following symlinks to get the real path.
 * Falls back to resolve() if the path doesn't exist yet.
 */
export function safeRealPath(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    // Path doesn't exist, fall back to resolve
    return resolve(path);
  }
}

export function isValidDirectory(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export function isValidFile(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
}

export function getRelativePath(basePath: string, filePath: string): string {
  return relative(basePath, filePath);
}

/**
 * Check if child path is within parent path.
 * Uses realpath to resolve symlinks and prevent path traversal attacks.
 */
export function isSubPath(parent: string, child: string): boolean {
  try {
    // Resolve symlinks to get actual paths
    const realParent = safeRealPath(parent);
    const realChild = safeRealPath(child);
    const rel = relative(realParent, realChild);
    return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
  } catch {
    return false;
  }
}
