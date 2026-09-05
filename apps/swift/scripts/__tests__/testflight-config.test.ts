import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  parseTestFlightUploadConfig,
  verifyTestFlightReplacementReadiness,
  xcodeArchiveOverrides,
} from '../lib/testflight-config';

// The default marketing version is derived from the monorepo version so a
// `bun bump` cannot silently desync the Swift TestFlight uploads. Read it here
// too rather than hardcoding, so these tests survive the next bump.
const monorepoVersion = (
  JSON.parse(readFileSync(resolve(__dirname, '../../../../package.json'), 'utf-8')) as {
    version: string;
  }
).version;

describe('parseTestFlightUploadConfig', () => {
  it('builds the App Store listing identity', () => {
    const config = parseTestFlightUploadConfig({
      argv: [],
      env: { BUILD_NUMBER: '456' },
    });

    expect(config).toMatchObject({
      staging: false,
      dryRun: false,
      scheme: 'PackRat-iOS',
      configuration: 'Release',
      bundleId: 'com.andrewbierman.packrat',
      watchBundleId: 'com.andrewbierman.packrat.watchkitapp',
      companionBundleId: 'com.andrewbierman.packrat',
      displayName: 'PackRat',
      marketingVersion: monorepoVersion,
      buildNumber: '456',
      apiEnvironment: 'production',
    });
    expect(xcodeArchiveOverrides({ config, teamId: 'TEAM123' })).toEqual([
      `MARKETING_VERSION=${monorepoVersion}`,
      'CURRENT_PROJECT_VERSION=456',
      'DEVELOPMENT_TEAM=TEAM123',
      'PACKRAT_IOS_BUNDLE_IDENTIFIER=com.andrewbierman.packrat',
      'PACKRAT_WATCH_BUNDLE_IDENTIFIER=com.andrewbierman.packrat.watchkitapp',
      'PACKRAT_COMPANION_BUNDLE_IDENTIFIER=com.andrewbierman.packrat',
      'PACKRAT_DISPLAY_NAME=PackRat',
    ]);
  });

  it('uses the staging scheme without changing the app identity', () => {
    expect(
      parseTestFlightUploadConfig({
        argv: ['--staging'],
        env: { BUILD_NUMBER: '789' },
      }),
    ).toMatchObject({
      staging: true,
      dryRun: false,
      scheme: 'PackRat-iOS-Staging',
      configuration: 'Staging',
      bundleId: 'com.andrewbierman.packrat',
      watchBundleId: 'com.andrewbierman.packrat.watchkitapp',
      companionBundleId: 'com.andrewbierman.packrat',
      displayName: 'PackRat',
      apiEnvironment: 'dev',
    });
  });

  it('supports dry-run preflight without changing identity', () => {
    expect(
      parseTestFlightUploadConfig({
        argv: ['--dry-run'],
        env: { BUILD_NUMBER: '101' },
      }),
    ).toMatchObject({
      dryRun: true,
      bundleId: 'com.andrewbierman.packrat',
      displayName: 'PackRat',
      marketingVersion: monorepoVersion,
      apiEnvironment: 'production',
      buildNumber: '101',
    });
  });

  it('allows an explicit marketing version override for controlled release testing', () => {
    const config = parseTestFlightUploadConfig({
      argv: ['--production'],
      env: { BUILD_NUMBER: '2026072101', MARKETING_VERSION: '2.1.1' },
    });

    expect(config.marketingVersion).toBe('2.1.1');
    expect(xcodeArchiveOverrides({ config, teamId: 'TEAM123' })).toContain(
      'MARKETING_VERSION=2.1.1',
    );
  });

  it('rejects conflicting API profile flags', () => {
    expect(() => parseTestFlightUploadConfig({ argv: ['--staging', '--production'] })).toThrow(
      'Use either --staging or --production, not both.',
    );
  });

  it('verifies replacement settings for seamless TestFlight update', () => {
    const config = parseTestFlightUploadConfig({
      argv: ['--production'],
      env: { BUILD_NUMBER: '2026071802' },
    });

    expect(
      verifyTestFlightReplacementReadiness({
        config,
        currentAppStoreBuildNumber: '2026071801',
      }),
    ).toEqual({ ok: true, errors: [], warnings: [] });
  });

  // The parser can no longer emit a non-App-Store identity, but the readiness
  // guard is the last line of defence before an upload, so it still has to
  // reject a hand-built config carrying the retired beta listing's bundle ids.
  it('rejects a config carrying the retired Swift beta bundle ids', () => {
    const config = {
      ...parseTestFlightUploadConfig({
        argv: ['--production'],
        env: { BUILD_NUMBER: '2026071802' },
      }),
      bundleId: 'com.andrewbierman.packrat.swift',
      companionBundleId: 'com.andrewbierman.packrat.swift',
      watchBundleId: 'com.andrewbierman.packrat.swift.watchkitapp',
    };

    const readiness = verifyTestFlightReplacementReadiness({
      config,
      currentAppStoreBuildNumber: '2026071801',
    });

    expect(readiness.ok).toBe(false);
    expect(readiness.errors).toContain(
      'Expected iOS bundle id com.andrewbierman.packrat, got com.andrewbierman.packrat.swift.',
    );
  });

  it('rejects stale replacement build numbers', () => {
    const config = parseTestFlightUploadConfig({
      argv: ['--production'],
      env: { BUILD_NUMBER: '2026071801' },
    });

    const readiness = verifyTestFlightReplacementReadiness({
      config,
      currentAppStoreBuildNumber: '2026071801',
    });

    expect(readiness.ok).toBe(false);
    expect(readiness.errors).toContain(
      'Build number 2026071801 must be greater than current App Store/TestFlight build 2026071801.',
    );
  });

  it('warns when current App Store build is not supplied', () => {
    const config = parseTestFlightUploadConfig({
      argv: ['--production'],
      env: { BUILD_NUMBER: '2026071802' },
    });

    const readiness = verifyTestFlightReplacementReadiness({ config });

    expect(readiness.ok).toBe(true);
    expect(readiness.warnings).toContain(
      'APP_STORE_CURRENT_BUILD_NUMBER was not provided; verify the replacement build number is greater than the latest App Store Connect build before upload.',
    );
  });

  it('rejects missing current App Store build when strict replacement readiness is required', () => {
    const config = parseTestFlightUploadConfig({
      argv: ['--production'],
      env: { BUILD_NUMBER: '2026071802' },
    });

    const readiness = verifyTestFlightReplacementReadiness({
      config,
      requireCurrentAppStoreBuildNumber: true,
    });

    expect(readiness.ok).toBe(false);
    expect(readiness.errors).toContain(
      'APP_STORE_CURRENT_BUILD_NUMBER was not provided; verify the replacement build number is greater than the latest App Store Connect build before upload.',
    );
  });
});
