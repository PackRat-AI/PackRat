#!/usr/bin/env bun
/**
 * Verifies that the Swift TestFlight upload settings are compatible with a
 * seamless update of the existing Expo iOS listing.
 *
 * This is a preflight gate only; it does not archive or upload.
 *
 * Usage:
 *   APP_STORE_CURRENT_BUILD_NUMBER=123 BUILD_NUMBER=456 \
 *     bun apps/swift/scripts/verify-testflight-replacement.ts --replacement --production
 */
import { nodeEnv } from '@packrat/env/node';
import { safeJsonStringify } from '@packrat/utils';
import {
  parseTestFlightUploadConfig,
  TestFlightConfigError,
  verifyTestFlightReplacementReadiness,
} from './lib/testflight-config';

const HELP = process.argv.includes('--help') || process.argv.includes('-h');

function usage(): string {
  return [
    'Usage:',
    '  bun apps/swift/scripts/verify-testflight-replacement.ts --replacement --production',
    '',
    'Recommended env:',
    '  BUILD_NUMBER                    build number intended for upload',
    '  APP_STORE_CURRENT_BUILD_NUMBER  latest existing PackRat App Store/TestFlight build',
  ].join('\n');
}

if (HELP) {
  console.log(usage());
  process.exit(0);
}

try {
  const config = parseTestFlightUploadConfig({
    argv: process.argv.slice(2),
    env: { BUILD_NUMBER: nodeEnv.BUILD_NUMBER },
  });
  const readiness = verifyTestFlightReplacementReadiness({
    config,
    currentAppStoreBuildNumber: nodeEnv.APP_STORE_CURRENT_BUILD_NUMBER,
  });
  const report = {
    lane: config.lane,
    bundleId: config.bundleId,
    watchBundleId: config.watchBundleId,
    companionBundleId: config.companionBundleId,
    displayName: config.displayName,
    configuration: config.configuration,
    apiEnvironment: config.apiEnvironment,
    buildNumber: config.buildNumber,
    currentAppStoreBuildNumber: nodeEnv.APP_STORE_CURRENT_BUILD_NUMBER ?? null,
    ok: readiness.ok,
    errors: readiness.errors,
    warnings: readiness.warnings,
  };

  console.log(safeJsonStringify(report, null, 2));
  if (!readiness.ok) process.exit(1);
} catch (error) {
  if (error instanceof TestFlightConfigError) {
    console.error(`${error.message}\n\n${usage()}`);
    process.exit(1);
  }
  throw error;
}
