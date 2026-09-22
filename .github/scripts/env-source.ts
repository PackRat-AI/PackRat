// Locating the one `.env.local` that every checkout reads.
//
// `.env.local` is gitignored, so `git worktree add` never copies it. Resolving
// it relative to the current checkout therefore leaves every new worktree with
// no environment at all — and the hand-copied `.dev.vars` files that grew up to
// work around that drift out of sync with the root as keys are added.
//
// A linked worktree's `.git` is a file pointing at `<main>/.git/worktrees/<name>`,
// and `git rev-parse --git-common-dir` resolves to the main checkout's `.git`
// from anywhere inside the tree. Its parent is the main checkout, which is where
// the single real `.env.local` lives.

import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'fs-extra';

export const ENV_FILE_NAME = '.env.local';

/**
 * Absolute path of the main checkout, even when called from a linked worktree.
 * Falls back to `startDir` when git is unavailable or this is not a repo.
 */
export function mainCheckoutRoot(startDir: string): string {
  try {
    const commonDir = execFileSync(
      'git',
      ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      {
        cwd: startDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    ).trim();
    if (commonDir) return path.dirname(commonDir);
  } catch {
    // Not a git checkout, or git is missing — use the directory as given.
  }
  return startDir;
}

export interface EnvSource {
  /** Absolute path of the `.env.local` that was found, if any. */
  path: string;
  exists: boolean;
  /** True when the file came from the main checkout rather than this worktree. */
  inherited: boolean;
}

/**
 * Resolve the `.env.local` a checkout should read.
 *
 * A worktree-local `.env.local` still wins when present, so anyone who wants a
 * deliberately different environment for one worktree can still have it. The
 * main checkout's file is the fallback, which is what makes a fresh worktree
 * work with no setup.
 */
export function resolveEnvSource(checkoutRoot: string): EnvSource {
  const local = path.join(checkoutRoot, ENV_FILE_NAME);
  if (fs.existsSync(local)) return { path: local, exists: true, inherited: false };

  const main = path.join(mainCheckoutRoot(checkoutRoot), ENV_FILE_NAME);
  if (main !== local && fs.existsSync(main)) return { path: main, exists: true, inherited: true };

  return { path: local, exists: false, inherited: false };
}

/** Trailing ` # comment` on a value line — only when unquoted and space-preceded. */
const RE_INLINE_COMMENT = /\s+#.*$/;

/**
 * Parse `KEY=value` lines, ignoring blanks and comments.
 *
 * Strips surrounding quotes and an unquoted trailing `# comment`; the real
 * .env.local carries inline comments on value lines, and leaving them attached
 * makes an otherwise-valid URL fail validation.
 */
export function parseEnv(text: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const rawLine of text.replaceAll('\r\n', '\n').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    const quoted = value.length > 1 && /^["']/.test(value) && value.at(-1) === value[0];
    if (quoted) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(RE_INLINE_COMMENT, '').trim();
    }
    vars[key] = value;
  }
  return vars;
}

/** Keys present in `.env.example` but missing (or empty) in the resolved env. */
export function missingKeys(opts: { examplePath: string; envText: string }): string[] {
  if (!fs.existsSync(opts.examplePath)) return [];
  const expected = Object.keys(parseEnv(fs.readFileSync(opts.examplePath, 'utf8')));
  const actual = parseEnv(opts.envText);
  return expected.filter((key) => !actual[key]);
}
