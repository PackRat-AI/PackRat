import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';

const paths: string[] = [];
afterEach(async () => {
  await Promise.all(paths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});
const verifier = fileURLToPath(new URL('../lib/verify-chat-acceptance-build.py', import.meta.url));
async function products(values?: Record<string, string>) {
  const path = await mkdtemp(join(tmpdir(), 'packrat-chat-build-'));
  paths.push(path);
  if (values) {
    const app = join(path, 'PackRat-iOS.app');
    await mkdir(app);
    const entries = Object.entries(values)
      .map(([key, value]) => `<key>${key}</key><string>${value}</string>`)
      .join('');
    await writeFile(
      join(app, 'Info.plist'),
      `<?xml version="1.0"?><plist version="1.0"><dict>${entries}</dict></plist>`,
    );
  }
  return path;
}
const isolated = { PACKRAT_ENV: 'local', SENTRY_DSN: '', REVENUECAT_API_KEY: '' };
it('accepts only an explicitly isolated built app', async () => {
  const result = spawnSync('python3', [verifier, await products(isolated)], { encoding: 'utf8' });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('telemetry and purchases disabled');
});
it.each([
  'SENTRY_DSN',
  'REVENUECAT_API_KEY',
])('rejects configured %s without exposing its value', async (key) => {
  const result = spawnSync(
    'python3',
    [verifier, await products({ ...isolated, [key]: 'synthetic-must-not-log' })],
    { encoding: 'utf8' },
  );
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(`explicitly empty ${key}`);
  expect(result.stderr).not.toContain('synthetic-must-not-log');
});
it('rejects missing app, missing isolation keys and deployed environment', async () => {
  for (const values of [
    undefined,
    { PACKRAT_ENV: 'local' },
    { ...isolated, PACKRAT_ENV: 'production' },
  ]) {
    const result = spawnSync('python3', [verifier, await products(values)], { encoding: 'utf8' });
    expect(result.status).toBe(1);
  }
});
