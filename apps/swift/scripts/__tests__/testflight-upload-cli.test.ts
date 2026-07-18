import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { env as currentEnv } from 'node:process';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '../../../..');
const script = resolve(repoRoot, 'apps/swift/scripts/upload-testflight.ts');
const verifyScript = resolve(repoRoot, 'apps/swift/scripts/verify-testflight-replacement.ts');

describe('upload-testflight CLI', () => {
  it('uses BUILD_NUMBER in dry-run preflight output', () => {
    const output = execFileSync('bun', [script, '--replacement', '--production', '--dry-run'], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: { ...currentEnv, APPLE_ASC_PROVIDER: 'PackRatProvider', BUILD_NUMBER: '2026071801' },
    });

    const preflight = JSON.parse(output);
    expect(preflight).toMatchObject({
      lane: 'replacement',
      bundleId: 'com.andrewbierman.packrat',
      displayName: 'PackRat',
      buildNumber: '2026071801',
      apiEnvironment: 'production',
      ascProvider: 'PackRatProvider',
    });
    expect(preflight.archiveOverrides).toContain('CURRENT_PROJECT_VERSION=2026071801');
  });

  it('verifies replacement TestFlight readiness from the CLI', () => {
    const output = execFileSync('bun', [verifyScript, '--replacement', '--production'], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...currentEnv,
        BUILD_NUMBER: '2026071802',
        APP_STORE_CURRENT_BUILD_NUMBER: '2026071801',
      },
    });

    const report = JSON.parse(output);
    expect(report).toMatchObject({
      lane: 'replacement',
      bundleId: 'com.andrewbierman.packrat',
      displayName: 'PackRat',
      apiEnvironment: 'production',
      buildNumber: '2026071802',
      currentAppStoreBuildNumber: '2026071801',
      ok: true,
      errors: [],
    });
  });
});
