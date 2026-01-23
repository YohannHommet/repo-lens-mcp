import type { SgNode } from '@ast-grep/napi'
import type { Repository } from '../types/repository.js'
import type { SymbolKind, SymbolResult, SymbolSearchOptions } from '../types/symbols.js'

import { readFile } from 'node:fs/promises'
import { parse } from '@ast-grep/napi'
import fg from 'fast-glob'
import { SYMBOL_SEARCH_IGNORE_PATTERNS } from '../constants.js'
import { getLangFromFile, getLangNameFromFile, getSupportedExtensions } from '../parsers/language-registry.js'
import { LANGUAGE_PATTERNS } from '../parsers/patterns/index.js'
import { logger } from '../utils/logger.js'
import { getRelativePath } from '../utils/path-utils.js'

export class SymbolSearchEngine {
  async search(
    options: SymbolSearchOptions,
    repositories: Repository[],
  ): Promise<SymbolResult[]> {
    const results: SymbolResult[] = []
    const maxPerRepo = options.maxResults
      ? Math.ceil(options.maxResults / repositories.length)
      : 500

    for (const repo of repositories) {
      try {
        const repoResults = await this.searchInRepo(repo, options, maxPerRepo)
        results.push(...repoResults)

        if (options.maxResults && results.length >= options.maxResults) {
          break
        }
      }
      catch (error) {
        logger.error('Error searching repository', { repo: repo.path, error })
      }
    }

    if (options.maxResults && results.length > options.maxResults) {
      return results.slice(0, options.maxResults)
    }

    return results
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

    for (const filePath of files) {
      if (results.length >= maxResults)
        break

      try {
        const fileResults = await this.searchInFile(repo, filePath, options)
        results.push(...fileResults)
      }
      catch (error) {
        logger.debug('Error parsing file', { filePath, error })
      }
    }

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

    const patterns = languagePatterns.patterns[options.kind] || []

    // Also search arrow functions for function kind
    const allPatterns
      = options.kind === 'function' && languagePatterns.arrowFunctions
        ? [...patterns, ...languagePatterns.arrowFunctions]
        : patterns

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

    for (const pattern of allPatterns) {
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
          const exported = this.checkExportStatus(match, name, content)

          // Apply exportedOnly filter
          if (options.exportedOnly && !exported) {
            continue
          }

          seenSymbols.add(symbolKey)
          const signature = this.extractSignature(match.text(), options.kind)

          results.push({
            repository: repo.id,
            repositoryAlias: repo.alias,
            filePath,
            relativePath: getRelativePath(repo.path, filePath),
            name,
            kind: options.kind,
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
      const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`, 'i')
      return regex.test(name)
    }
    return name.toLowerCase().includes(pattern.toLowerCase())
  }

  /**
   * Check if a symbol is exported using AST analysis and regex fallback
   */
  private checkExportStatus(match: SgNode, name: string, content: string): boolean {
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

    // 2. Check for named exports: export { name }
    const namedExportRegex = new RegExp(`export\\s*{[^}]*\\b${name}\\b[^}]*}`, 'm')
    if (namedExportRegex.test(content))
      return true

    // 3. Check for default export: export default name
    const defaultExportRegex = new RegExp(`export\\s+default\\s+\\b${name}\\b`, 'm')
    if (defaultExportRegex.test(content))
      return true

    // 4. Fallback: check if line starts with export (legacy check)
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
