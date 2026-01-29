#!/usr/bin/env npx tsx
/**
 * Performance benchmark script for repo-lens-mcp
 *
 * Usage: npx tsx scripts/benchmark.ts [repo-path]
 *
 * If no repo-path provided, uses the current repository.
 */

import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import fg from 'fast-glob'
import { RepositoryManager } from '../src/core/repository-manager.js'
import { APIRouteSearchEngine } from '../src/search/api-route-search.js'
import { SymbolSearchEngine } from '../src/search/symbol-search.js'

const CONFIG_DIR = '/tmp/repo-lens-benchmark'

interface BenchmarkResult {
  name: string
  duration: number
  iterations: number
  avgDuration: number
  resultCount: number
}

async function benchmark<T>(
  name: string,
  fn: () => Promise<T>,
  iterations = 3,
): Promise<BenchmarkResult & { result: T }> {
  const durations: number[] = []
  let result!: T
  let resultCount = 0

  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    result = await fn()
    const end = performance.now()
    durations.push(end - start)

    if (Array.isArray(result)) {
      resultCount = result.length
    }
  }

  const totalDuration = durations.reduce((a, b) => a + b, 0)

  return {
    name,
    duration: totalDuration,
    iterations,
    avgDuration: totalDuration / iterations,
    resultCount,
    result,
  }
}

function formatMs(ms: number): string {
  if (ms < 1)
    return `${(ms * 1000).toFixed(0)}μs`
  if (ms < 1000)
    return `${ms.toFixed(1)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

async function countFiles(repoPath: string): Promise<{ total: number, ts: number, js: number }> {
  const allFiles = await fg('**/*.{ts,tsx,js,jsx,mjs,cjs}', {
    cwd: repoPath,
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
  })

  const tsFiles = allFiles.filter(f => f.endsWith('.ts') || f.endsWith('.tsx'))
  const jsFiles = allFiles.filter(f => !f.endsWith('.ts') && !f.endsWith('.tsx'))

  return { total: allFiles.length, ts: tsFiles.length, js: jsFiles.length }
}

async function main() {
  const repoPath = process.argv[2] || process.cwd()
  const resolvedPath = resolve(repoPath)

  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Repo Lens MCP - Performance Benchmark')
  console.log('═══════════════════════════════════════════════════════════')
  console.log()

  // Count files
  const fileCounts = await countFiles(resolvedPath)
  console.log(`Repository: ${resolvedPath}`)
  console.log(`Files: ${fileCounts.total} total (${fileCounts.ts} TS, ${fileCounts.js} JS)`)
  console.log()

  // Initialize
  const repoManager = new RepositoryManager(CONFIG_DIR)
  const symbolSearch = new SymbolSearchEngine()
  const apiRouteSearch = new APIRouteSearchEngine()

  // Benchmark: Repository Registration
  console.log('─── Repository Registration ───')
  const regResult = await benchmark('register_repository', async () => {
    // Unregister first if exists
    try {
      await repoManager.unregister(resolvedPath)
    }
    catch { /* ignore */ }
    return repoManager.register(resolvedPath, { alias: 'benchmark-repo' })
  }, 1)
  console.log(`  Registration: ${formatMs(regResult.avgDuration)}`)
  console.log()

  const repos = repoManager.list()

  // Benchmark: Symbol Search
  console.log('─── Symbol Search ───')

  const funcResult = await benchmark('find_functions', () =>
    symbolSearch.search({ kind: 'function', maxResults: 100 }, repos))
  console.log(`  find_functions (all): ${formatMs(funcResult.avgDuration)} (${funcResult.resultCount} results)`)

  const funcPatternResult = await benchmark('find_functions (pattern)', () =>
    symbolSearch.search({ kind: 'function', name: 'handle*', maxResults: 100 }, repos))
  console.log(`  find_functions (handle*): ${formatMs(funcPatternResult.avgDuration)} (${funcPatternResult.resultCount} results)`)

  const classResult = await benchmark('find_classes', () =>
    symbolSearch.search({ kind: 'class', maxResults: 100 }, repos))
  console.log(`  find_classes: ${formatMs(classResult.avgDuration)} (${classResult.resultCount} results)`)

  const typeResult = await benchmark('find_types', () =>
    symbolSearch.search({ kind: 'type', maxResults: 100 }, repos))
  console.log(`  find_types: ${formatMs(typeResult.avgDuration)} (${typeResult.resultCount} results)`)

  const interfaceResult = await benchmark('find_interfaces', () =>
    symbolSearch.search({ kind: 'interface', maxResults: 100 }, repos))
  console.log(`  find_interfaces: ${formatMs(interfaceResult.avgDuration)} (${interfaceResult.resultCount} results)`)

  const exportedResult = await benchmark('find_functions (exported)', () =>
    symbolSearch.search({ kind: 'function', exportedOnly: true, maxResults: 100 }, repos))
  console.log(`  find_functions (exported only): ${formatMs(exportedResult.avgDuration)} (${exportedResult.resultCount} results)`)
  console.log()

  // Benchmark: API Route Search
  console.log('─── API Route Search ───')

  const routeResult = await benchmark('find_api_routes', () =>
    apiRouteSearch.search({ maxResults: 100 }, repos))
  console.log(`  find_api_routes (all): ${formatMs(routeResult.avgDuration)} (${routeResult.resultCount} results)`)

  const expressResult = await benchmark('find_api_routes (express)', () =>
    apiRouteSearch.search({ framework: 'express', maxResults: 100 }, repos))
  console.log(`  find_api_routes (express): ${formatMs(expressResult.avgDuration)} (${expressResult.resultCount} results)`)
  console.log()

  // Summary
  console.log('─── Summary ───')
  const totalSearchTime = funcResult.avgDuration + classResult.avgDuration + typeResult.avgDuration
  console.log(`  Total symbol search time: ${formatMs(totalSearchTime)}`)
  console.log(`  Avg per search type: ${formatMs(totalSearchTime / 3)}`)
  console.log()

  // Cleanup
  try {
    await repoManager.unregister(resolvedPath)
  }
  catch { /* ignore */ }

  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Benchmark complete!')
  console.log('═══════════════════════════════════════════════════════════')
}

main().catch(console.error)
