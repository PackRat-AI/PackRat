// Configuration, port allocation and branch naming for `bun devenv`.

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { basename, resolve } from 'node:path';
import { listRecords } from './state';

/** Neon project that owns every PackRat database branch. */
export const NEON_PROJECT_ID_DEFAULT = '';

/** Parent branch every ephemeral environment forks from. */
export const DEFAULT_PARENT_BRANCH = 'development';

/** Ephemeral branches are namespaced so they are trivially distinguishable. */
export const BRANCH_PREFIX = 'devenv/';

/** Port search window — above wrangler's 8787 default to avoid collisions. */
const PORT_RANGE_START = 8788;
const PORT_RANGE_END = 8850;

export const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const vars: Record<string, string> = {};
  for (const rawLine of readFileSync(path, 'utf8').replaceAll('\r\n', '\n').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    vars[line.slice(0, eq).trim()] = line
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  }
  return vars;
}

/**
 * Resolve a setting from the process env first, then the repo's .env.local.
 * Lets an agent override per-invocation without editing shared files.
 */
export function setting(key: string): string | undefined {
  return process.env[key] || parseEnvFile(resolve(REPO_ROOT, '.env.local'))[key] || undefined;
}

export function requireNeonApiKey(): string {
  const key = setting('NEON_API_KEY');
  if (!key) {
    throw new Error(
      'NEON_API_KEY is not set.\n' +
        '  Create one at https://console.neon.tech/app/settings/api-keys\n' +
        '  then add `NEON_API_KEY=...` to .env.local (repo root).',
    );
  }
  return key;
}

export function requireNeonProjectId(): string {
  const id = setting('NEON_PROJECT_ID') || NEON_PROJECT_ID_DEFAULT;
  if (!id) {
    throw new Error(
      'NEON_PROJECT_ID is not set.\n' +
        '  Find it at https://console.neon.tech → Project settings → General\n' +
        '  then add `NEON_PROJECT_ID=...` to .env.local (repo root).',
    );
  }
  return id;
}

/** Slugify into something safe for a Neon branch name and a filename. */
export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  if (!slug) throw new Error(`Cannot derive a usable name from "${input}"`);
  return slug;
}

/**
 * Default environment name: the current git branch, falling back to the
 * worktree directory name. Two agents on different branches therefore get
 * different environments without either having to name anything.
 */
export function defaultName(cwd: string): string {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (branch && branch !== 'HEAD') return slugify(branch);
  } catch {
    // Not a git checkout — fall through to the directory name.
  }
  return slugify(basename(cwd));
}

function portFree(port: number): Promise<boolean> {
  return new Promise((done) => {
    const server = createServer();
    server.once('error', () => done(false));
    server.once('listening', () => server.close(() => done(true)));
    server.listen(port, '127.0.0.1');
  });
}

/**
 * First port that is both unclaimed in the registry and actually bindable.
 * The registry check keeps two simultaneous `devenv up` runs from racing onto
 * the same port before either has bound it.
 */
export async function allocatePort(): Promise<number> {
  const claimed = new Set(listRecords().map((r) => r.port));
  for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port++) {
    if (claimed.has(port)) continue;
    if (await portFree(port)) return port;
  }
  throw new Error(`No free port in ${PORT_RANGE_START}-${PORT_RANGE_END}. Run: bun devenv list`);
}
