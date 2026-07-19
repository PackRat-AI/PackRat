import { execFileSync, spawnSync } from 'node:child_process';
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

  it('fails replacement preflight CLI without the current App Store build number', () => {
    const env = { ...currentEnv, BUILD_NUMBER: '2026071802' };
    delete env.APP_STORE_CURRENT_BUILD_NUMBER;

    const result = spawnSync('bun', [verifyScript, '--replacement', '--production'], {
      cwd: repoRoot,
      encoding: 'utf8',
      env,
    });

    expect(result.status).toBe(1);
    const report = JSON.parse(result.stdout);
    expect(report.ok).toBe(false);
    expect(report.errors).toContain(
      'APP_STORE_CURRENT_BUILD_NUMBER was not provided; verify the replacement build number is greater than the latest App Store Connect build before upload.',
    );
  });

  it('blocks real replacement uploads before Apple credentials when current build is missing', () => {
    const env = {
      ...currentEnv,
      APPLE_ID: 'tester@example.com',
      APPLE_APP_PASSWORD: 'test-app-password',
      APPLE_TEAM_ID: 'TEAM123',
      BUILD_NUMBER: '2026071802',
    };
    delete env.APP_STORE_CURRENT_BUILD_NUMBER;

    const result = spawnSync('bun', [script, '--replacement', '--production'], {
      cwd: repoRoot,
      encoding: 'utf8',
      env,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Replacement TestFlight preflight failed: APP_STORE_CURRENT_BUILD_NUMBER was not provided',
    );
    expect(result.stderr).not.toContain('xcodebuild archive');
  });
});
