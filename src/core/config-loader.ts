import type { RepoConfigEntry } from '../config/types.js'

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { parse } from 'yaml'
import { z } from 'zod'
import { logger } from '../utils/logger.js'

const repoConfigSchema = z.object({
  repositories: z.array(z.object({
    path: z.string().min(1),
    alias: z.string().min(1).optional(),
  })),
})

export class ConfigLoader {
  private configFilePath: string | null
  private isExplicit: boolean

  constructor(configFilePath: string | null) {
    this.configFilePath = configFilePath
    // If --config was passed, the path is always explicit.
    // The caller (loadConfig) resolves to default when no --config flag,
    // so we detect explicitness by checking process.argv.
    this.isExplicit = process.argv.includes('--config')
  }

  async load(): Promise<RepoConfigEntry[]> {
    if (!this.configFilePath) {
      return []
    }

    if (!existsSync(this.configFilePath)) {
      if (this.isExplicit) {
        throw new Error(`Config file not found: ${this.configFilePath}`)
      }
      logger.info('No config file found, using ad-hoc paths only', { path: this.configFilePath })
      return []
    }

    const content = await readFile(this.configFilePath, 'utf-8')
    const raw = parse(content)
    const config = repoConfigSchema.parse(raw)

    const entries = config.repositories.map(entry => ({
      ...entry,
      path: entry.path.replace(/^~/, homedir()),
    }))

    logger.info('Configuration loaded', {
      path: this.configFilePath,
      repositoryCount: entries.length,
    })

    return entries
  }
}
