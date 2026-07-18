export type TestFlightLane = 'side-by-side' | 'replacement';

export type TestFlightUploadConfig = {
  lane: TestFlightLane;
  staging: boolean;
  dryRun: boolean;
  scheme: string;
  configuration: string;
  bundleId: string;
  watchBundleId: string;
  companionBundleId: string;
  displayName: string;
  buildNumber: string;
  apiEnvironment: 'dev' | 'production';
};

export class TestFlightConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TestFlightConfigError';
  }
}

const SIDE_BY_SIDE_BUNDLE_ID = 'com.andrewbierman.packrat.swift';
const REPLACEMENT_BUNDLE_ID = 'com.andrewbierman.packrat';
const SIDE_BY_SIDE_WATCH_BUNDLE_ID = 'com.andrewbierman.packrat.swift.watchkitapp';
const REPLACEMENT_WATCH_BUNDLE_ID = 'com.andrewbierman.packrat.watchkitapp';

export function parseTestFlightUploadConfig(input: {
  argv: readonly string[];
  env?: { BUILD_NUMBER?: string | undefined };
}): TestFlightUploadConfig {
  const { argv, env = {} } = input;
  const sideBySide = argv.includes('--side-by-side');
  const replacement = argv.includes('--replacement');
  const staging = argv.includes('--staging');
  const production = argv.includes('--production');
  const dryRun = argv.includes('--dry-run');

  if (sideBySide === replacement) {
    throw new TestFlightConfigError(
      'Choose exactly one TestFlight lane: --replacement for the existing Expo/App Store listing, or --side-by-side for the separate Swift beta app.',
    );
  }
  if (staging && production) {
    throw new TestFlightConfigError('Use either --staging or --production, not both.');
  }

  const lane: TestFlightLane = replacement ? 'replacement' : 'side-by-side';
  const buildNumber = env.BUILD_NUMBER ?? String(Math.floor(Date.now() / 1000));

  return {
    lane,
    staging,
    dryRun,
    scheme: staging ? 'PackRat-iOS-Staging' : 'PackRat-iOS',
    configuration: staging ? 'Staging' : 'Release',
    bundleId: replacement ? REPLACEMENT_BUNDLE_ID : SIDE_BY_SIDE_BUNDLE_ID,
    watchBundleId: replacement ? REPLACEMENT_WATCH_BUNDLE_ID : SIDE_BY_SIDE_WATCH_BUNDLE_ID,
    companionBundleId: replacement ? REPLACEMENT_BUNDLE_ID : SIDE_BY_SIDE_BUNDLE_ID,
    displayName: replacement ? 'PackRat' : 'PackRat Swift',
    buildNumber,
    apiEnvironment: staging ? 'dev' : 'production',
  };
}

export function xcodeArchiveOverrides(input: {
  config: TestFlightUploadConfig;
  teamId: string;
}): string[] {
  const { config, teamId } = input;
  return [
    `CURRENT_PROJECT_VERSION=${config.buildNumber}`,
    `DEVELOPMENT_TEAM=${teamId}`,
    `PACKRAT_IOS_BUNDLE_IDENTIFIER=${config.bundleId}`,
    `PACKRAT_WATCH_BUNDLE_IDENTIFIER=${config.watchBundleId}`,
    `PACKRAT_COMPANION_BUNDLE_IDENTIFIER=${config.companionBundleId}`,
    `PACKRAT_DISPLAY_NAME=${config.displayName}`,
  ];
}
