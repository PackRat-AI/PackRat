import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { mainCheckoutRoot, parseEnv, resolveEnvSource } from '../../../.github/scripts/env-source';

const created: string[] = [];

function tempRepo(): string {
  // macOS /var is a symlink to /private/var and git reports the resolved path.
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'packrat-envsrc-')));
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
  return main;
}

afterAll(() => {
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
});

describe('parseEnv', () => {
  it('strips an unquoted trailing comment from a value', () => {
    // The real .env.local carries inline comments on value lines; leaving them
    // attached turns a valid URL into an unparseable one.
    const vars = parseEnv('NEON_DATABASE_URL=postgresql://a:b@h.neon.tech/db # primary');
    expect(vars.NEON_DATABASE_URL).toBe('postgresql://a:b@h.neon.tech/db');
  });

  it('keeps a # that is part of a quoted value', () => {
    expect(parseEnv('SECRET="abc#def"').SECRET).toBe('abc#def');
  });

  it('keeps a # with no preceding whitespace', () => {
    expect(parseEnv('SECRET=abc#def').SECRET).toBe('abc#def');
  });

  it('ignores blank lines and full-line comments', () => {
    expect(parseEnv('\n# note\nA=1\n')).toEqual({ A: '1' });
  });

  it('preserves = characters inside a value', () => {
    expect(parseEnv('TOKEN=a=b=c').TOKEN).toBe('a=b=c');
  });
});

describe('resolveEnvSource', () => {
  it('prefers a .env.local in the checkout itself', () => {
    const main = tempRepo();
    writeFileSync(join(main, '.env.local'), 'A=1');
    const source = resolveEnvSource(main);
    expect(source).toMatchObject({ exists: true, inherited: false });
    expect(source.path).toBe(join(main, '.env.local'));
  });

  it('falls back to the main checkout from a linked worktree', () => {
    // This is the whole point: `git worktree add` never copies the gitignored
    // .env.local, so a fresh worktree must read through to the main checkout.
    const main = tempRepo();
    writeFileSync(join(main, '.env.local'), 'A=1');
    const worktree = join(main, '..', 'wt');
    execFileSync('git', ['worktree', 'add', '-q', '-b', 'feature', worktree], {
      cwd: main,
      stdio: 'ignore',
    });

    const source = resolveEnvSource(worktree);
    expect(source.inherited).toBe(true);
    expect(source.path).toBe(join(main, '.env.local'));
    expect(mainCheckoutRoot(worktree)).toBe(main);
  });

  it('reports not-exists when neither checkout has one', () => {
    const main = tempRepo();
    expect(resolveEnvSource(main).exists).toBe(false);
  });

  it('does not throw outside a git repository', () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'packrat-nogit-')));
    created.push(dir);
    expect(resolveEnvSource(dir).exists).toBe(false);
    expect(mainCheckoutRoot(dir)).toBe(dir);
  });
});
