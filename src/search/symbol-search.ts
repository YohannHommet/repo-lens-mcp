import type { SgNode } from '@ast-grep/napi'
import type { Repository } from '../types/repository.js'
import type { SymbolKind, SymbolResult, SymbolSearchOptions } from '../types/symbols.js'

import { readFile } from 'node:fs/promises'
import { parse } from '@ast-grep/napi'
import fg from 'fast-glob'
import pLimit from 'p-limit'
import { SYMBOL_SEARCH_IGNORE_PATTERNS } from '../constants.js'
import { getLangFromFile, getLangNameFromFile, getSupportedExtensions } from '../parsers/language-registry.js'
import { LANGUAGE_PATTERNS } from '../parsers/patterns/index.js'
import { logger } from '../utils/logger.js'
import { getRelativePath } from '../utils/path-utils.js'

const FILE_CONCURRENCY = 8
const MAX_PATTERN_CACHE_SIZE = 100

export class SymbolSearchEngine {
  private patternRegexCache = new Map<string, RegExp>()
  private exportBlockCache = new Map<string, { named: Set<string>, default: string | null }>()

  async search(
    options: SymbolSearchOptions,
    repositories: Repository[],
  ): Promise<SymbolResult[]> {
    const maxResults = options.maxResults ?? 100
    const maxPerRepo = Math.ceil(maxResults / repositories.length)

    // Process repositories in parallel
    const repoResultsArray = await Promise.all(
      repositories.map(repo =>
        this.searchInRepo(repo, options, maxPerRepo).catch((error) => {
          logger.error('Error searching repository', { repo: repo.path, error })
          return []
        }),
      ),
    )

    // Flatten and limit results
    const results = repoResultsArray.flat()
    return results.slice(0, maxResults)
  }

  private async searchInRepo(
    repo: Repository,
    options: SymbolSearchOptions,
    maxResults: number,
  ): Promise<SymbolResult[]> {
    const results: SymbolResult[] = []
    const extensions = options.language
      ? this.getExtensionsForLanguage(options.language)
      : getSupportedExtensions()

    const globPatterns = extensions.map(ext => `**/*${ext}`)

    const files = await fg(globPatterns, {
      cwd: repo.path,
      ignore: SYMBOL_SEARCH_IGNORE_PATTERNS,
      absolute: true,
      onlyFiles: true,
    })

    const limit = pLimit(FILE_CONCURRENCY)
    let resultCount = 0

    const fileResults = await Promise.all(
      files.map(filePath =>
        limit(() => {
          if (resultCount >= maxResults) return Promise.resolve([])
          return this.searchInFile(repo, filePath, options).then((results) => {
            resultCount += results.length
            return results
          }).catch((error) => {
            logger.debug('Error parsing file', { filePath, error })
            return []
          })
        }),
      ),
    )

    for (const fileResult of fileResults) {
      results.push(...fileResult)
      if (results.length >= maxResults)
        break
    }

    // Clear file-level caches after repo search
    this.exportBlockCache.clear()

    return results
  }

  private async searchInFile(
    repo: Repository,
    filePath: string,
    options: SymbolSearchOptions,
  ): Promise<SymbolResult[]> {
    const results: SymbolResult[] = []
    const lang = getLangFromFile(filePath)
    const langName = getLangNameFromFile(filePath)

    if (!lang || !langName)
      return results

    const content = await readFile(filePath, 'utf-8')
    const languagePatterns = LANGUAGE_PATTERNS[langName]

    if (!languagePatterns)
      return results

    // Content pre-filter: skip AST parsing if the exact name isn't in the file
    if (options.name && !options.name.includes('*')) {
      if (!content.toLowerCase().includes(options.name.toLowerCase())) {
        return results
      }
    }

    // Resolve which kinds to search
    const kindsToSearch = options.kinds ?? (options.kind ? [options.kind] : [])

    if (kindsToSearch.length === 0)
      return results

    // Collect patterns tagged by kind
    const allPatterns: Array<{ pattern: string, kind: SymbolKind }> = []
    for (const kind of kindsToSearch) {
      const kindPatterns = languagePatterns.patterns[kind] || []
      for (const pattern of kindPatterns) {
        allPatterns.push({ pattern, kind })
      }
      // Also search arrow functions for function kind
      if (kind === 'function' && languagePatterns.arrowFunctions) {
        for (const pattern of languagePatterns.arrowFunctions) {
          allPatterns.push({ pattern, kind })
        }
      }
    }

    if (allPatterns.length === 0)
      return results

    // Parse AST once for all patterns (performance fix)
    let ast
    try {
      ast = parse(lang, content)
    }
    catch (error) {
      logger.debug('Failed to parse file', { filePath, error })
      return results
    }

    const root = ast.root()
    // Track seen symbols to avoid duplicates
    const seenSymbols = new Set<string>()

    for (const { pattern, kind: matchKind } of allPatterns) {
      try {
        const matches = root.findAll(pattern)

        for (const match of matches) {
          const nameNode = match.getMatch('NAME')
          const name = nameNode?.text() || 'anonymous'
          const range = match.range()

          // Create unique key for deduplication
          const symbolKey = `${name}:${range.start.line}`
          if (seenSymbols.has(symbolKey)) {
            continue
          }

          // Apply name filter
          if (options.name && !this.matchesName(name, options.name)) {
            continue
          }

          // Check export status
          const exported = this.checkExportStatus(match, name, content, filePath)

          // Apply exportedOnly filter
          if (options.exportedOnly && !exported) {
            continue
          }

          seenSymbols.add(symbolKey)
          const signature = this.extractSignature(match.text(), matchKind)

          results.push({
            repository: repo.id,
            repositoryAlias: repo.alias,
            filePath,
            relativePath: getRelativePath(repo.path, filePath),
            name,
            kind: matchKind,
            startLine: range.start.line + 1,
            endLine: range.end.line + 1,
            signature,
            exported,
          })
        }
      }
      catch (error) {
        logger.debug('Pattern matching error', { pattern, error })
      }
    }

    return results
  }

  private matchesName(name: string, pattern: string): boolean {
    if (pattern.includes('*')) {
      let regex = this.patternRegexCache.get(pattern)
      if (!regex) {
        // Clear cache if it gets too large to prevent memory leaks
        if (this.patternRegexCache.size >= MAX_PATTERN_CACHE_SIZE) {
          this.patternRegexCache.clear()
        }
        regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`, 'i')
        this.patternRegexCache.set(pattern, regex)
      }
      return regex.test(name)
    }
    return name.toLowerCase().includes(pattern.toLowerCase())
  }

  /**
   * Parse export block once per file to avoid repeated regex operations
   */
  private parseExportBlock(content: string): { named: Set<string>, default: string | null } {
    const named = new Set<string>()
    let defaultExport: string | null = null

    // Parse named exports: export { foo, bar, baz }
    // Handles: export { foo }, export { foo as bar }, export { type Foo }
    const namedExportBlocks = content.match(/export\s*\{([^}]+)\}/g)
    if (namedExportBlocks) {
      for (const block of namedExportBlocks) {
        // Extract the content inside braces
        const innerMatch = block.match(/\{([^}]+)\}/)
        if (innerMatch) {
          // Split by comma and extract each export name
          const exports = innerMatch[1].split(',')
          for (const exp of exports) {
            // Handle: "foo", "foo as bar", "type Foo", "type Foo as Bar"
            // We want the LOCAL name (before 'as' if present)
            const trimmed = exp.trim()
            // Skip if empty
            if (!trimmed)
              continue
            // Remove 'type' keyword if present
            const withoutType = trimmed.replace(/^type\s+/, '')
            // Get the local name (before 'as' if renaming)
            const localName = withoutType.split(/\s+as\s+/)[0].trim()
            if (localName && /^\w+$/.test(localName)) {
              named.add(localName)
            }
          }
        }
      }
    }

    // Parse default export: export default Foo
    const defaultMatch = content.match(/export\s+default\s+(\w+)/)
    if (defaultMatch) {
      defaultExport = defaultMatch[1]
    }

    return { named, default: defaultExport }
  }

  /**
   * Check if a symbol is exported using AST analysis and cached export block
   */
  private checkExportStatus(match: SgNode, name: string, content: string, filePath: string): boolean {
    // 1. Check AST ancestry for export_statement
    // This handles: export function..., export class..., export const...
    try {
      let node: SgNode | null = match
      for (let i = 0; i < 3; i++) {
        if (!node)
          break
        if (node.kind() === 'export_statement')
          return true
        node = node.parent()
      }
    }
    catch {
      // Ignore AST errors
    }

    // 2. Use cached export block instead of per-symbol regex
    let exports = this.exportBlockCache.get(filePath)
    if (!exports) {
      exports = this.parseExportBlock(content)
      this.exportBlockCache.set(filePath, exports)
    }

    if (exports.named.has(name))
      return true
    if (exports.default === name)
      return true

    // 3. Fallback: check if line starts with export (legacy check)
    try {
      const range = match.range()
      const lineStart = content.lastIndexOf('\n', range.start.index) + 1
      const lineEnd = content.indexOf('\n', range.start.index)
      const line = content.substring(lineStart, lineEnd !== -1 ? lineEnd : content.length)
      if (line.trim().startsWith('export'))
        return true
    }
    catch {
      // Ignore
    }

    return false
  }

  private extractSignature(text: string, kind: SymbolKind): string {
    const lines = text.split('\n')
    const firstLine = lines[0]

    switch (kind) {
      case 'function':
      case 'method': {
        // Get just the function declaration without body
        // Fixed regex to be linear (no backtracking issues)
        const funcMatch = firstLine.match(/^[^(]*\([^)]*\)(?:\s*:[^{]+)?/)
        return funcMatch ? funcMatch[0].trim() : firstLine.replace('{', '').trim()
      }

      case 'class':
      case 'interface': {
        // Get class/interface declaration
        const classMatch = firstLine.match(/^(?:export\s+)?(?:abstract\s+)?(?:class|interface)\s+\w[^{]*/)
        return classMatch ? classMatch[0].trim() : firstLine.replace('{', '').trim()
      }

      case 'type':
        // Get full type definition (first line or until semicolon)
        return firstLine.trim()

      default:
        return firstLine.trim()
    }
  }

  private getExtensionsForLanguage(language: string): string[] {
    const langMap: Record<string, string[]> = {
      typescript: ['.ts', '.tsx'],
      javascript: ['.js', '.jsx', '.mjs', '.cjs'],
      ts: ['.ts', '.tsx'],
      js: ['.js', '.jsx', '.mjs', '.cjs'],
    }
    return langMap[language.toLowerCase()] || getSupportedExtensions()
  }
}
