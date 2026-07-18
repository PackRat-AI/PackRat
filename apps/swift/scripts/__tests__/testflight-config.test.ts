import { describe, expect, it } from 'vitest';
import {
  parseTestFlightUploadConfig,
  TestFlightConfigError,
  xcodeArchiveOverrides,
} from '../lib/testflight-config';

describe('parseTestFlightUploadConfig', () => {
  it('requires an explicit TestFlight lane', () => {
    expect(() => parseTestFlightUploadConfig({ argv: [], env: { BUILD_NUMBER: '123' } })).toThrow(
      TestFlightConfigError,
    );
  });

  it('rejects conflicting lanes', () => {
    expect(() =>
      parseTestFlightUploadConfig({
        argv: ['--side-by-side', '--replacement'],
        env: { BUILD_NUMBER: '123' },
      }),
    ).toThrow('Choose exactly one TestFlight lane');
  });

  it('builds the side-by-side Swift beta identity', () => {
    expect(
      parseTestFlightUploadConfig({
        argv: ['--side-by-side'],
        env: { BUILD_NUMBER: '123' },
      }),
    ).toMatchObject({
      lane: 'side-by-side',
      staging: false,
      dryRun: false,
      scheme: 'PackRat-iOS',
      configuration: 'Release',
      bundleId: 'com.andrewbierman.packrat.swift',
      watchBundleId: 'com.andrewbierman.packrat.swift.watchkitapp',
      companionBundleId: 'com.andrewbierman.packrat.swift',
      displayName: 'PackRat Swift',
      buildNumber: '123',
      apiEnvironment: 'production',
    });
  });

  it('builds the replacement identity for the existing Expo listing', () => {
    const config = parseTestFlightUploadConfig({
      argv: ['--replacement'],
      env: { BUILD_NUMBER: '456' },
    });

    expect(config).toMatchObject({
      lane: 'replacement',
      staging: false,
      dryRun: false,
      scheme: 'PackRat-iOS',
      configuration: 'Release',
      bundleId: 'com.andrewbierman.packrat',
      watchBundleId: 'com.andrewbierman.packrat.watchkitapp',
      companionBundleId: 'com.andrewbierman.packrat',
      displayName: 'PackRat',
      buildNumber: '456',
      apiEnvironment: 'production',
    });
    expect(xcodeArchiveOverrides({ config, teamId: 'TEAM123' })).toEqual([
      'CURRENT_PROJECT_VERSION=456',
      'DEVELOPMENT_TEAM=TEAM123',
      'PACKRAT_IOS_BUNDLE_IDENTIFIER=com.andrewbierman.packrat',
      'PACKRAT_WATCH_BUNDLE_IDENTIFIER=com.andrewbierman.packrat.watchkitapp',
      'PACKRAT_COMPANION_BUNDLE_IDENTIFIER=com.andrewbierman.packrat',
      'PACKRAT_DISPLAY_NAME=PackRat',
    ]);
  });

  it('uses the staging scheme without changing the selected lane identity', () => {
    expect(
      parseTestFlightUploadConfig({
        argv: ['--replacement', '--staging'],
        env: { BUILD_NUMBER: '789' },
      }),
    ).toMatchObject({
      lane: 'replacement',
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
        argv: ['--replacement', '--dry-run'],
        env: { BUILD_NUMBER: '101' },
      }),
    ).toMatchObject({
      lane: 'replacement',
      dryRun: true,
      bundleId: 'com.andrewbierman.packrat',
      displayName: 'PackRat',
      apiEnvironment: 'production',
      buildNumber: '101',
    });
  });

  it('rejects conflicting API profile flags', () => {
    expect(() =>
      parseTestFlightUploadConfig({ argv: ['--replacement', '--staging', '--production'] }),
    ).toThrow('Use either --staging or --production, not both.');
  });
});
