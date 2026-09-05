import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isString, toRecord } from '@packrat/guards';
import { safeJsonParse, safeJsonStringify } from '@packrat/utils';

export type TestFlightUploadConfig = {
  staging: boolean;
  dryRun: boolean;
  scheme: string;
  configuration: string;
  bundleId: string;
  watchBundleId: string;
  companionBundleId: string;
  displayName: string;
  marketingVersion: string;
  buildNumber: string;
  apiEnvironment: 'dev' | 'production';
};

export type TestFlightReplacementReadinessInput = {
  config: TestFlightUploadConfig;
  currentAppStoreBuildNumber?: string | undefined;
  requireCurrentAppStoreBuildNumber?: boolean | undefined;
};

export type TestFlightReplacementReadiness = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

export class TestFlightConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TestFlightConfigError';
  }
}

// The Swift app ships to the one public App Store listing. The separate
// `com.andrewbierman.packrat.swift` beta listing that once ran in parallel is
// retired — every upload now targets the real app.
const BUNDLE_ID = 'com.andrewbierman.packrat';
const WATCH_BUNDLE_ID = 'com.andrewbierman.packrat.watchkitapp';
const DISPLAY_NAME = 'PackRat';
/**
 * The Swift marketing version tracks the monorepo version in the root
 * `package.json`, which `bun bump` owns. Reading it here instead of hardcoding a
 * constant keeps this script, `apps/swift/project.yml`, and the monorepo version
 * from drifting apart across releases.
 */
function readMonorepoVersion(): string {
  const rootPackageJsonPath = join(__dirname, '../../../../package.json');
  // strict: a malformed root package.json must fail loudly here rather than
  // fall through to the version check as an unparsed string.
  const parsed = toRecord(
    safeJsonParse(readFileSync(rootPackageJsonPath, 'utf-8'), { strict: true }),
  );
  if (!('version' in parsed)) {
    throw new TestFlightConfigError(
      `Root package.json at ${rootPackageJsonPath} has no "version" field; cannot resolve the Swift marketing version.`,
    );
  }
  const { version } = parsed;
  if (!isString(version) || version.trim() === '') {
    throw new TestFlightConfigError(
      `Root package.json "version" must be a non-empty string, got ${safeJsonStringify(parsed.version)}.`,
    );
  }
  return version;
}

export function parseTestFlightUploadConfig(input: {
  argv: readonly string[];
  env?: { BUILD_NUMBER?: string | undefined; MARKETING_VERSION?: string | undefined };
}): TestFlightUploadConfig {
  const { argv, env = {} } = input;
  const staging = argv.includes('--staging');
  const production = argv.includes('--production');
  const dryRun = argv.includes('--dry-run');

  if (staging && production) {
    throw new TestFlightConfigError('Use either --staging or --production, not both.');
  }

  const marketingVersion = env.MARKETING_VERSION ?? readMonorepoVersion();
  const buildNumber = env.BUILD_NUMBER ?? String(Math.floor(Date.now() / 1000));

  return {
    staging,
    dryRun,
    scheme: staging ? 'PackRat-iOS-Staging' : 'PackRat-iOS',
    configuration: staging ? 'Staging' : 'Release',
    bundleId: BUNDLE_ID,
    watchBundleId: WATCH_BUNDLE_ID,
    companionBundleId: BUNDLE_ID,
    displayName: DISPLAY_NAME,
    marketingVersion,
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
    `MARKETING_VERSION=${config.marketingVersion}`,
    `CURRENT_PROJECT_VERSION=${config.buildNumber}`,
    `DEVELOPMENT_TEAM=${teamId}`,
    `PACKRAT_IOS_BUNDLE_IDENTIFIER=${config.bundleId}`,
    `PACKRAT_WATCH_BUNDLE_IDENTIFIER=${config.watchBundleId}`,
    `PACKRAT_COMPANION_BUNDLE_IDENTIFIER=${config.companionBundleId}`,
    `PACKRAT_DISPLAY_NAME=${config.displayName}`,
  ];
}

function isPositiveInteger(value: string): boolean {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0 && String(numeric) === value;
}

export function verifyTestFlightReplacementReadiness(
  input: TestFlightReplacementReadinessInput,
): TestFlightReplacementReadiness {
  const { config, currentAppStoreBuildNumber, requireCurrentAppStoreBuildNumber = false } = input;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (
    config.staging ||
    config.configuration !== 'Release' ||
    config.apiEnvironment !== 'production'
  ) {
    errors.push('Use the production Release archive for a seamless TestFlight update.');
  }
  if (config.bundleId !== BUNDLE_ID) {
    errors.push(`Expected iOS bundle id ${BUNDLE_ID}, got ${config.bundleId}.`);
  }
  if (config.watchBundleId !== WATCH_BUNDLE_ID) {
    errors.push(`Expected watch bundle id ${WATCH_BUNDLE_ID}, got ${config.watchBundleId}.`);
  }
  if (config.companionBundleId !== BUNDLE_ID) {
    errors.push(
      `Expected watch companion bundle id ${BUNDLE_ID}, got ${config.companionBundleId}.`,
    );
  }
  if (config.displayName !== 'PackRat') {
    errors.push(`Expected display name PackRat, got ${config.displayName}.`);
  }
  if (!isPositiveInteger(config.buildNumber)) {
    errors.push(`Build number must be a positive integer, got ${config.buildNumber}.`);
  }

  if (currentAppStoreBuildNumber) {
    if (!isPositiveInteger(currentAppStoreBuildNumber)) {
      errors.push(
        `Current App Store build number must be a positive integer, got ${currentAppStoreBuildNumber}.`,
      );
    } else if (
      isPositiveInteger(config.buildNumber) &&
      Number(config.buildNumber) <= Number(currentAppStoreBuildNumber)
    ) {
      errors.push(
        `Build number ${config.buildNumber} must be greater than current App Store/TestFlight build ${currentAppStoreBuildNumber}.`,
      );
    }
  } else {
    const message =
      'APP_STORE_CURRENT_BUILD_NUMBER was not provided; verify the replacement build number is greater than the latest App Store Connect build before upload.';
    if (requireCurrentAppStoreBuildNumber) {
      errors.push(message);
    } else {
      warnings.push(message);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}
