import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { settingFrom } from '../config';

/**
 * `setting` must resolve `.env.local` through the **main checkout**, not from
 * the root it is called with.
 *
 * In a linked worktree those differ: the worktree has no `.env.local` by
 * design, because secrets live in the main checkout and are inherited.
 * Resolving against the worktree found nothing and reported credentials as
 * missing while they sat in the main checkout — which made `devenv up`
 * unusable from a worktree, the case it exists to serve.
 *
 * Every assertion below runs against a real `git worktree`. A fixture is the
 * only way to catch this: the suite itself runs from the main checkout, where
 * the correct and the broken lookup return the same answer, which is precisely
 * why the defect shipped.
 */

const created: string[] = [];

afterAll(() => {
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
});

/** A main checkout with `.env.local`, plus a linked worktree without one. */
function repoWithWorktree(envContents: string): { main: string; worktree: string } {
  // macOS /var is a symlink to /private/var and git reports the resolved path.
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'packrat-devenv-setting-')));
  created.push(dir);

  const main = join(dir, 'main');
  mkdirSync(main);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: main, stdio: 'ignore' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  writeFileSync(join(main, 'README'), 'x');
  git('add', '-A');
  git('commit', '-qm', 'init');

  // Only the main checkout gets the env file, mirroring reality: it is
  // gitignored, so `git worktree add` never copies it.
  writeFileSync(join(main, '.env.local'), envContents);

  const worktree = join(dir, 'wt');
  git('worktree', 'add', '-q', '-b', 'feature', worktree);

  return { main, worktree };
}

describe('settingFrom', () => {
  it('reads the main checkout .env.local when called from a worktree', () => {
    const { worktree } = repoWithWorktree('NEON_API_KEY=napi_from_main\n');
    expect(settingFrom('NEON_API_KEY', worktree)).toBe('napi_from_main');
  });

  it('reads the same value when called from the main checkout', () => {
    const { main } = repoWithWorktree('NEON_API_KEY=napi_from_main\n');
    expect(settingFrom('NEON_API_KEY', main)).toBe('napi_from_main');
  });

  it('prefers the process env, so a per-invocation override still wins', () => {
    const { worktree } = repoWithWorktree('NEON_API_KEY=napi_from_main\n');
    process.env.NEON_API_KEY = 'napi_from_process';
    try {
      expect(settingFrom('NEON_API_KEY', worktree)).toBe('napi_from_process');
    } finally {
      delete process.env.NEON_API_KEY;
    }
  });

  it('returns undefined for a key that is set nowhere', () => {
    const { worktree } = repoWithWorktree('NEON_API_KEY=napi_from_main\n');
    expect(settingFrom('PACKRAT_ABSENT_SPEC', worktree)).toBeUndefined();
  });

  it('ignores comments and blank lines', () => {
    const { worktree } = repoWithWorktree('# a comment\n\nNEON_PROJECT_ID=proj-1\n');
    expect(settingFrom('NEON_PROJECT_ID', worktree)).toBe('proj-1');
    expect(settingFrom('#', worktree)).toBeUndefined();
  });

  it('strips surrounding quotes from a value', () => {
    const { worktree } = repoWithWorktree('NEON_API_KEY="napi_quoted"\n');
    expect(settingFrom('NEON_API_KEY', worktree)).toBe('napi_quoted');
  });
});
