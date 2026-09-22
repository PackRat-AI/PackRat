// On-disk registry of live dev environments.
//
// Lives outside the repo (~/.packrat/devenv/) so parallel git worktrees share
// one view: an agent in worktree A can see that port 8790 is taken by an
// environment in worktree B, and `devenv list` shows every live Neon branch on
// the machine regardless of where it was started.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const STATE_DIR = join(homedir(), '.packrat', 'devenv');

export interface DevEnvRecord {
  /** Slug identifying the environment; also the Neon branch suffix. */
  name: string;
  neonBranchId: string;
  neonBranchName: string;
  /** Pooled connection string handed to the API worker. */
  databaseUrl: string;
  port: number;
  /** Absolute path of the worktree this environment was created from. */
  worktree: string;
  createdAt: string;
  /** PID of the wrangler dev process, when one is running. */
  apiPid?: number;
}

function recordPath(name: string): string {
  return join(STATE_DIR, `${name}.json`);
}

export function ensureStateDir(): void {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
}

export function saveRecord(record: DevEnvRecord): void {
  ensureStateDir();
  writeFileSync(recordPath(record.name), `${JSON.stringify(record, null, 2)}\n`);
}

export function readRecord(name: string): DevEnvRecord | undefined {
  const path = recordPath(name);
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, 'utf8')) as DevEnvRecord;
}

export function deleteRecord(name: string): void {
  const path = recordPath(name);
  if (existsSync(path)) rmSync(path);
}

export function listRecords(): DevEnvRecord[] {
  if (!existsSync(STATE_DIR)) return [];
  return readdirSync(STATE_DIR)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => {
      try {
        return [JSON.parse(readFileSync(join(STATE_DIR, f), 'utf8')) as DevEnvRecord];
      } catch {
        // A half-written record should not break `list` or port allocation.
        return [];
      }
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** True when the process is alive. Signal 0 probes without delivering. */
export function isAlive(pid: number | undefined): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
