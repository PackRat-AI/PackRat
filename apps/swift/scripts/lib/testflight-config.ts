export type TestFlightLane = 'side-by-side' | 'replacement';

export type TestFlightUploadConfig = {
  lane: TestFlightLane;
  staging: boolean;
  scheme: string;
  configuration: string;
  bundleId: string;
  displayName: string;
  buildNumber: string;
};

export class TestFlightConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TestFlightConfigError';
  }
}

const SIDE_BY_SIDE_BUNDLE_ID = 'com.andrewbierman.packrat.swift';
const REPLACEMENT_BUNDLE_ID = 'com.andrewbierman.packrat';

export function parseTestFlightUploadConfig(input: {
  argv: readonly string[];
  env?: { BUILD_NUMBER?: string | undefined };
}): TestFlightUploadConfig {
  const { argv, env = {} } = input;
  const sideBySide = argv.includes('--side-by-side');
  const replacement = argv.includes('--replacement');
  const staging = argv.includes('--staging');
  const production = argv.includes('--production');

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
    scheme: staging ? 'PackRat-iOS-Staging' : 'PackRat-iOS',
    configuration: staging ? 'Staging' : 'Release',
    bundleId: replacement ? REPLACEMENT_BUNDLE_ID : SIDE_BY_SIDE_BUNDLE_ID,
    displayName: replacement ? 'PackRat' : 'PackRat Swift',
    buildNumber,
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
    `PRODUCT_BUNDLE_IDENTIFIER=${config.bundleId}`,
    `PACKRAT_DISPLAY_NAME=${config.displayName}`,
  ];
}
