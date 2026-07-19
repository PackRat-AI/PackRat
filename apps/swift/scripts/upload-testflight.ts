#!/usr/bin/env bun
/**
 * Archive the native Swift PackRat iOS app and upload it to TestFlight.
 *
 * Choose the App Store Connect lane explicitly:
 *   --replacement   existing Expo/App Store listing (`com.andrewbierman.packrat`,
 *                   display name `PackRat`) for true TestFlight update testing.
 *   --side-by-side  separate Swift beta listing (`com.andrewbierman.packrat.swift`,
 *                   display name `PackRat Swift`) for parallel beta installs.
 *
 * Auth uses an Apple ID + app-specific password (no App Store Connect API key
 * required). Generate a password at appleid.apple.com -> Sign-In & Security ->
 * App-Specific Passwords.
 *
 * Required env (put in apps/swift/.env.local, gitignored):
 *   APPLE_ID                 your Apple ID email
 *   APPLE_APP_PASSWORD       app-specific password (xxxx-xxxx-xxxx-xxxx)
 *   APPLE_TEAM_ID            Apple Developer Team ID used for signing
 *
 * Optional env:
 *   APPLE_ASC_PROVIDER       App Store Connect provider short name for altool;
 *                            defaults to APPLE_TEAM_ID when omitted
 *   BUILD_NUMBER             CFBundleVersion for this upload (default: timestamp)
 *   APP_STORE_CURRENT_BUILD_NUMBER
 *                            Required for --replacement uploads; latest existing
 *                            PackRat App Store/TestFlight build number.
 *
 * Flags:
 *   --replacement            Archive for the existing Expo/App Store iOS listing.
 *   --side-by-side           Archive for the separate Swift beta listing.
 *   --staging                Archive the Staging config (PACKRAT_ENV=dev) so the
 *                            build targets the deployed DEV API instead of production.
 *   --production             Optional clarity flag; Release/production is the default
 *                            API profile when --staging is absent.
 *   --dry-run                Print the resolved archive identity/settings and exit
 *                            before reading Apple credentials or running Xcode.
 *
 * Usage:
 *   bun apps/swift/scripts/upload-testflight.ts --replacement
 *   bun apps/swift/scripts/upload-testflight.ts --replacement --dry-run
 *   bun apps/swift/scripts/upload-testflight.ts --side-by-side --staging
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nodeEnv } from '@packrat/env/node';
import { safeJsonStringify } from '@packrat/utils';
import {
  parseTestFlightUploadConfig,
  TestFlightConfigError,
  type TestFlightUploadConfig,
  verifyTestFlightReplacementReadiness,
  xcodeArchiveOverrides,
} from './lib/testflight-config';
import { findExportedIPA } from './lib/testflight-export';

const SWIFT_DIR = new URL('..', import.meta.url).pathname;
const PROJECT = join(SWIFT_DIR, 'PackRat.xcodeproj');
const HELP = process.argv.includes('--help') || process.argv.includes('-h');

function usage(): string {
  return [
    'Usage:',
    '  bun apps/swift/scripts/upload-testflight.ts --replacement [--production|--staging] [--dry-run]',
    '  bun apps/swift/scripts/upload-testflight.ts --side-by-side [--production|--staging] [--dry-run]',
    '',
    'Lanes:',
    '  --replacement   Existing Expo/App Store listing: com.andrewbierman.packrat, PackRat.',
    '  --side-by-side  Separate Swift beta listing: com.andrewbierman.packrat.swift, PackRat Swift.',
  ].join('\n');
}

if (HELP) {
  console.log(usage());
  process.exit(0);
}

let uploadConfig: TestFlightUploadConfig;
try {
  uploadConfig = parseTestFlightUploadConfig({
    argv: process.argv.slice(2),
    env: { BUILD_NUMBER: nodeEnv.BUILD_NUMBER },
  });
} catch (error) {
  if (error instanceof TestFlightConfigError) {
    console.error(`${error.message}\n\n${usage()}`);
    process.exit(1);
  }
  throw error;
}

function printPreflight(input: {
  config: TestFlightUploadConfig;
  teamId?: string;
  ascProvider?: string;
}) {
  const {
    config,
    teamId = '<APPLE_TEAM_ID>',
    ascProvider = '<APPLE_ASC_PROVIDER or APPLE_TEAM_ID>',
  } = input;
  const archiveOverrides = xcodeArchiveOverrides({ config, teamId });
  console.log(
    safeJsonStringify({
      lane: config.lane,
      bundleId: config.bundleId,
      watchBundleId: config.watchBundleId,
      companionBundleId: config.companionBundleId,
      displayName: config.displayName,
      scheme: config.scheme,
      configuration: config.configuration,
      apiEnvironment: config.apiEnvironment,
      buildNumber: config.buildNumber,
      ascProvider,
      archiveOverrides,
    }),
  );
}

if (uploadConfig.dryRun) {
  printPreflight({ config: uploadConfig, ascProvider: nodeEnv.APPLE_ASC_PROVIDER });
  process.exit(0);
}

function req(input: { name: 'APPLE_ID' | 'APPLE_APP_PASSWORD' | 'APPLE_TEAM_ID' }): string {
  const v = nodeEnv[input.name];
  if (!v) {
    console.error(`Missing required env var: ${input.name}. See script header.`);
    process.exit(1);
  }
  return v;
}

if (nodeEnv.BUILD_NUMBER) {
  uploadConfig = { ...uploadConfig, buildNumber: nodeEnv.BUILD_NUMBER };
}

if (uploadConfig.lane === 'replacement') {
  const readiness = verifyTestFlightReplacementReadiness({
    config: uploadConfig,
    currentAppStoreBuildNumber: nodeEnv.APP_STORE_CURRENT_BUILD_NUMBER,
    requireCurrentAppStoreBuildNumber: true,
  });
  if (!readiness.ok) {
    for (const error of readiness.errors)
      console.error(`Replacement TestFlight preflight failed: ${error}`);
    process.exit(1);
  }
}

const appleId = req({ name: 'APPLE_ID' });
const appPassword = req({ name: 'APPLE_APP_PASSWORD' });
const teamId = req({ name: 'APPLE_TEAM_ID' });
const ascProvider = nodeEnv.APPLE_ASC_PROVIDER ?? teamId;
printPreflight({ config: uploadConfig, teamId, ascProvider });

const work = mkdtempSync(join(tmpdir(), 'packrat-tf-'));
const archivePath = join(work, 'PackRat.xcarchive');
const exportDir = join(work, 'export');

function run(input: { cmd: string; args: string[] }) {
  const { cmd, args } = input;
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { stdio: 'inherit' });
}

// 1. Archive for a real device (TestFlight cannot accept a simulator build).
run({
  cmd: 'xcodebuild',
  args: [
    'archive',
    '-project',
    PROJECT,
    '-scheme',
    uploadConfig.scheme,
    '-configuration',
    uploadConfig.configuration,
    '-destination',
    'generic/platform=iOS',
    '-archivePath',
    archivePath,
    // Lets Xcode register the App IDs and generate provisioning profiles for
    // the (new) bundle ids on the fly, using the signed-in account.
    '-allowProvisioningUpdates',
    ...xcodeArchiveOverrides({ config: uploadConfig, teamId }),
  ],
});

// 2. Export a signed .ipa for App Store distribution.
const exportOptions = join(work, 'ExportOptions.plist');
writeFileSync(
  exportOptions,
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>teamID</key><string>${teamId}</string>
  <key>destination</key><string>export</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
</dict>
</plist>
`,
);

run({
  cmd: 'xcodebuild',
  args: [
    '-exportArchive',
    '-archivePath',
    archivePath,
    '-exportPath',
    exportDir,
    '-exportOptionsPlist',
    exportOptions,
    // Export also needs to generate the App Store distribution profiles for the
    // new bundle ids on the fly.
    '-allowProvisioningUpdates',
  ],
});

// 3. Upload to TestFlight via altool (app-specific-password auth).
// `--asc-provider` (team short name) is required when the Apple ID belongs to
// more than one team, so altool knows which one to deliver to.
const ipa = findExportedIPA(exportDir);
run({
  cmd: 'xcrun',
  args: [
    'altool',
    '--upload-app',
    '--type',
    'ios',
    '--file',
    ipa,
    '--username',
    appleId,
    '--password',
    appPassword,
    '--asc-provider',
    ascProvider,
  ],
});

console.log(
  `\n✓ Uploaded build ${uploadConfig.buildNumber} to TestFlight (${uploadConfig.bundleId}, ${uploadConfig.displayName}, ${uploadConfig.configuration}` +
    `${uploadConfig.staging ? ' -> dev API' : ' -> production'}, ${uploadConfig.lane}).`,
);
console.log('It will appear in App Store Connect after processing (usually 5-15 min).');
