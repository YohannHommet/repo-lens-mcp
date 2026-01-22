import { simpleGit, SimpleGit } from 'simple-git';
import { existsSync } from 'fs';
import { join } from 'path';

export interface GitInfo {
  remote?: string;
  branch: string;
  lastCommit: string;
}

export async function isGitRepository(path: string): Promise<boolean> {
  return existsSync(join(path, '.git'));
}

export async function getGitInfo(path: string): Promise<GitInfo> {
  const git: SimpleGit = simpleGit(path);

  try {
    const [branch, log, remotes] = await Promise.all([
      git.revparse(['--abbrev-ref', 'HEAD']),
      git.log({ maxCount: 1 }),
      git.getRemotes(true),
    ]);

    const remote = remotes.find((r) => r.name === 'origin')?.refs.fetch;

    return {
      remote,
      branch: branch.trim(),
      lastCommit: log.latest?.hash || 'unknown',
    };
  } catch {
    return {
      branch: 'unknown',
      lastCommit: 'unknown',
    };
  }
}
