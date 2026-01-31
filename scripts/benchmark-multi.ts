#!/usr/bin/env npx tsx
/**
 * Multi-repository benchmark for repo-lens-mcp
 *
 * Tests parallel repository processing performance.
 */

import { performance } from 'node:perf_hooks'
import { RepositoryManager } from '../src/core/repository-manager.js'
import { SymbolSearchEngine } from '../src/search/symbol-search.js'

const CONFIG_DIR = '/tmp/repo-lens-benchmark-multi'

function formatMs(ms: number): string {
  if (ms < 1)
    return `${(ms * 1000).toFixed(0)}μs`
  if (ms < 1000)
    return `${ms.toFixed(1)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

async function main() {
  const repoPaths = process.argv.slice(2)

  if (repoPaths.length < 2) {
    console.log('Usage: npx tsx scripts/benchmark-multi.ts <repo1> <repo2> [repo3...]')
    console.log('Example: npx tsx scripts/benchmark-multi.ts ~/project1 ~/project2')
    process.exit(1)
  }

  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Repo Lens MCP - Multi-Repository Benchmark')
  console.log('═══════════════════════════════════════════════════════════')
  console.log()

  const repoManager = new RepositoryManager(CONFIG_DIR)
  const symbolSearch = new SymbolSearchEngine()

  // Register all repos
  console.log(`Registering ${repoPaths.length} repositories...`)
  const regStart = performance.now()
  for (const path of repoPaths) {
    try {
      await repoManager.register(path)
      console.log(`  ✓ ${path}`)
    }
    catch (e: any) {
      console.log(`  ✗ ${path}: ${e.message}`)
    }
  }
  const regEnd = performance.now()
  console.log(`Total registration: ${formatMs(regEnd - regStart)}`)
  console.log()

  const repos = repoManager.list()
  console.log(`Searching across ${repos.length} repositories...`)
  console.log()

  // Search all repos at once
  const searchStart = performance.now()
  const results = await symbolSearch.search({ kind: 'function', maxResults: 200 }, repos)
  const searchEnd = performance.now()

  console.log('─── Results ───')
  console.log(`  Total functions found: ${results.length}`)
  console.log(`  Search time: ${formatMs(searchEnd - searchStart)}`)
  console.log(`  Avg per repo: ${formatMs((searchEnd - searchStart) / repos.length)}`)
  console.log()

  // Group by repo
  const byRepo = results.reduce((acc, r) => {
    const key = r.repositoryAlias || r.repository
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log('─── By Repository ───')
  for (const [repo, count] of Object.entries(byRepo)) {
    console.log(`  ${repo}: ${count} functions`)
  }
  console.log()

  // Cleanup
  for (const repo of repos) {
    try {
      await repoManager.unregister(repo.id)
    }
    catch { /* ignore */ }
  }

  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Benchmark complete!')
  console.log('═══════════════════════════════════════════════════════════')
}

main().catch(console.error)
