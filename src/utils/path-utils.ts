import { constants, existsSync, realpathSync, statSync } from 'node:fs'
import { open } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'

export function normalizePath(path: string): string {
  return resolve(path)
}

/**
 * Safely resolve a path, following symlinks to get the real path.
 * Falls back to resolve() if the path doesn't exist yet.
 */
export function safeRealPath(path: string): string {
  try {
    return realpathSync(path)
  }
  catch {
    return resolve(path)
  }
}

export function isValidDirectory(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isDirectory()
  }
  catch {
    return false
  }
}

export function getRelativePath(basePath: string, filePath: string): string {
  return relative(basePath, filePath)
}

/**
 * Get language identifier for Markdown based on file extension
 */
export function getLanguageForFile(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase() || ''
  const mapping: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    html: 'html',
    css: 'css',
    json: 'json',
    md: 'markdown',
    py: 'python',
    rs: 'rust',
    go: 'go',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    cs: 'csharp',
    sh: 'bash',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    xml: 'xml',
    sql: 'sql',
  }
  return mapping[extension] || ''
}

/**
 * Check if child path is within parent path.
 * Uses realpath to resolve symlinks and prevent path traversal attacks.
 *
 * WARNING: This has a TOCTOU (Time-Of-Check-Time-Of-Use) vulnerability.
 * Use safeOpenFile() for actual file operations to prevent race conditions.
 */
export function isSubPath(parent: string, child: string): boolean {
  try {
    // Resolve symlinks to get actual paths
    const realParent = safeRealPath(parent)
    const realChild = safeRealPath(child)
    const rel = relative(realParent, realChild)
    return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
  }
  catch {
    return false
  }
}

/**
 * Safely open a file with O_NOFOLLOW to prevent symlink attacks.
 * Re-verifies the path is within the allowed directory after opening.
 *
 * This prevents TOCTOU race conditions where a symlink could be swapped
 * between the isSubPath check and the actual file read.
 *
 * @param filePath - Absolute path to the file
 * @param allowedDir - Directory that filePath must be within
 * @returns File handle
 * @throws Error if file is outside allowed directory or is a symlink
 */
export async function safeOpenFile(filePath: string, allowedDir: string): Promise<{ fd: any, close: () => Promise<void> }> {
  // Initial check
  if (!isSubPath(allowedDir, filePath)) {
    throw new Error(`File is not within allowed directory: ${filePath}`)
  }

  // Open with O_NOFOLLOW to reject symlinks
  // Note: O_NOFOLLOW might not prevent all attacks on all platforms
  // but it's a good defense-in-depth measure
  let fileHandle
  try {
    // Open file with NOFOLLOW flag (fails if file is a symlink)
    fileHandle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW)
  }
  catch (error: any) {
    if (error.code === 'ELOOP' || error.code === 'EMLINK') {
      throw new Error('File is a symbolic link (security: symlinks not allowed)', { cause: error })
    }
    throw error
  }

  // Additional verification: check the opened file's real path
  // This helps catch race conditions
  try {
    const fd = fileHandle.fd
    // On Linux, we can verify via /proc/self/fd/{fd}
    // On other platforms, this might not work, but the O_NOFOLLOW should be sufficient
    if (process.platform === 'linux') {
      try {
        const fdPath = `/proc/self/fd/${fd}`
        const realPath = realpathSync(fdPath)
        if (!isSubPath(allowedDir, realPath)) {
          await fileHandle.close()
          throw new Error('Symlink attack detected: real path outside allowed directory')
        }
      }
      catch (error: any) {
        // If we can't verify via /proc/self/fd, continue
        // O_NOFOLLOW should have already prevented symlink issues
        if (error.message && error.message.includes('outside allowed directory')) {
          throw error
        }
      }
    }
  }
  catch (error) {
    if (fileHandle) {
      await fileHandle.close()
    }
    throw error
  }

  return {
    fd: fileHandle,
    close: async () => await fileHandle.close(),
  }
}
