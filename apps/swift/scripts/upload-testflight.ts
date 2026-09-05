#!/usr/bin/env bun
/**
 * Archive the native Swift PackRat iOS app and upload it to TestFlight.
 *
 * Uploads go to the one public App Store listing (`com.andrewbierman.packrat`,
 * display name `PackRat`). The separate `PackRat Swift` beta listing that once
 * ran in parallel is retired.
 *
 * Auth accepts either an App Store Connect API key or an Apple ID +
 * app-specific password (appleid.apple.com -> Sign-In & Security ->
 * App-Specific Passwords). See the env block below.
 *
 * Required env (put in apps/swift/.env.local, gitignored):
 *   APPLE_TEAM_ID            Apple Developer Team ID used for signing
 *
 * Then EITHER an App Store Connect API key (preferred — no Apple ID password,
 * no interactive account required):
 *   APPLE_ASC_API_KEY_ID     ASC API key id, e.g. 8WXNXX6SWS
 *   APPLE_ASC_API_ISSUER_ID  issuer UUID for that key (differs per team)
 * altool only finds the matching `AuthKey_<id>.p8` in one of these dirs:
 *   ./private_keys, ~/private_keys, ~/.private_keys,
 *   ~/.appstoreconnect/private_keys
 *
 * OR an Apple ID + app-specific password:
 *   APPLE_ID                 your Apple ID email
 *   APPLE_APP_PASSWORD       app-specific password (xxxx-xxxx-xxxx-xxxx)
 *
 * Optional env:
 *   APPLE_ASC_PROVIDER       App Store Connect provider short name for altool;
 *                            defaults to APPLE_TEAM_ID when omitted
 *   BUILD_NUMBER             CFBundleVersion for this upload (default: timestamp)
 *   MARKETING_VERSION        CFBundleShortVersionString for this upload
 *                            (default: the monorepo version from the root
 *                            package.json, which `bun bump` owns)
 *   APP_STORE_CURRENT_BUILD_NUMBER
 *                            Required; latest existing PackRat App Store /
 *                            TestFlight build number.
 *
 * Flags:
 *   --staging                Archive the Staging config (PACKRAT_ENV=dev) so the
 *                            build targets the deployed DEV API instead of production.
 *   --production             Optional clarity flag; Release/production is the default
 *                            API profile when --staging is absent.
 *   --dry-run                Print the resolved archive identity/settings and exit
 *                            before reading Apple credentials or running Xcode.
 *   --verify-archive-only    Archive, export, inspect binary metadata, then exit
 *                            before reading Apple ID upload credentials.
 *
 * Usage:
 *   bun apps/swift/scripts/upload-testflight.ts
 *   bun apps/swift/scripts/upload-testflight.ts --dry-run
 *   bun apps/swift/scripts/upload-testflight.ts --verify-archive-only
 *   bun apps/swift/scripts/upload-testflight.ts --staging
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nodeEnv } from '@packrat/env/node';
import { safeJsonStringify } from '@packrat/utils';
import { verifyTestFlightArchive, verifyTestFlightIPA } from './lib/testflight-binary';
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
const VERIFY_ARCHIVE_ONLY = process.argv.includes('--verify-archive-only');

function usage(): string {
  return [
    'Usage:',
    '  bun apps/swift/scripts/upload-testflight.ts [--production|--staging] [--dry-run]',
    '  bun apps/swift/scripts/upload-testflight.ts [--production|--staging] --verify-archive-only',
    '',
    'Uploads target the App Store listing: com.andrewbierman.packrat, PackRat.',
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
    env: { BUILD_NUMBER: nodeEnv.BUILD_NUMBER, MARKETING_VERSION: nodeEnv.MARKETING_VERSION },
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
      bundleId: config.bundleId,
      watchBundleId: config.watchBundleId,
      companionBundleId: config.companionBundleId,
      displayName: config.displayName,
      scheme: config.scheme,
      configuration: config.configuration,
      apiEnvironment: config.apiEnvironment,
      marketingVersion: config.marketingVersion,
      buildNumber: config.buildNumber,
      ascProvider,
      archiveOverrides,
    }),
  );
}

if (uploadConfig.dryRun) {
  // Pass the resolved team id so the dry run shows the real archive overrides.
  // Without it the preflight always printed `DEVELOPMENT_TEAM=<APPLE_TEAM_ID>`,
  // which hides exactly the misconfiguration a dry run exists to catch.
  printPreflight({
    config: uploadConfig,
    teamId: nodeEnv.APPLE_TEAM_ID,
    ascProvider: nodeEnv.APPLE_ASC_PROVIDER ?? nodeEnv.APPLE_TEAM_ID,
  });
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

{
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

const teamId = req({ name: 'APPLE_TEAM_ID' });

// Two auth paths. An App Store Connect API key is preferred — it needs no Apple
// ID password and no interactive account in Xcode. `altool` only finds the `.p8`
// in fixed directories, so the key must be in one of: ./private_keys,
// ~/private_keys, ~/.private_keys, ~/.appstoreconnect/private_keys.
const ascApiKeyId = nodeEnv.APPLE_ASC_API_KEY_ID;
const ascApiIssuer = nodeEnv.APPLE_ASC_API_ISSUER_ID;
const usesApiKey = Boolean(ascApiKeyId && ascApiIssuer);

const appleId = VERIFY_ARCHIVE_ONLY || usesApiKey ? undefined : req({ name: 'APPLE_ID' });
const appPassword =
  VERIFY_ARCHIVE_ONLY || usesApiKey ? undefined : req({ name: 'APPLE_APP_PASSWORD' });
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

function verifyBinary(input: {
  label: string;
  result: ReturnType<typeof verifyTestFlightArchive>;
}) {
  const { label, result } = input;
  if (!result.ok) {
    for (const error of result.errors) console.error(`${label} verification failed: ${error}`);
    process.exit(1);
  }
  const watch = result.watchApp ?? 'no embedded watch app';
  console.log(`✓ Verified ${label} metadata (${result.iosApp}, ${watch})`);
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
verifyBinary({
  label: 'TestFlight archive',
  result: verifyTestFlightArchive({ archivePath, config: uploadConfig }),
});

// 2. Export a signed .ipa for App Store distribution.
//
// Automatic signing asks Xcode's account system for a profile. On a machine with
// no Apple ID configured in Xcode that fails with `No Accounts` / `No profiles
// for '<bundle id>' were found`, even when the profile is installed. Set
// EXPORT_PROVISIONING_PROFILE to the profile's *name* to sign manually instead.
// See docs/macos-testflight.md, which hits the same wall on the macOS lane.
const exportProfileName = process.env.EXPORT_PROVISIONING_PROFILE?.trim();
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
${
  exportProfileName
    ? `  <key>signingStyle</key><string>manual</string>
  <key>signingCertificate</key><string>Apple Distribution</string>
  <key>provisioningProfiles</key>
  <dict>
    <key>${uploadConfig.bundleId}</key><string>${exportProfileName}</string>
  </dict>`
    : '  <key>signingStyle</key><string>automatic</string>'
}
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
verifyBinary({
  label: 'TestFlight IPA',
  result: verifyTestFlightIPA({ ipaPath: ipa, config: uploadConfig }),
});

if (VERIFY_ARCHIVE_ONLY) {
  console.log('\n✓ Archive/export verification passed; skipping TestFlight upload.');
  process.exit(0);
}

run({
  cmd: 'xcrun',
  args: [
    'altool',
    '--upload-app',
    '--type',
    'ios',
    '--file',
    ipa,
    // `--apiKey`/`--apiIssuer` and `--username`/`--password` are mutually
    // exclusive; altool rejects a mix of the two.
    ...(usesApiKey
      ? ['--apiKey', ascApiKeyId ?? '', '--apiIssuer', ascApiIssuer ?? '']
      : [
          '--username',
          appleId ?? '',
          '--password',
          appPassword ?? '',
          '--asc-provider',
          ascProvider,
        ]),
  ],
});

console.log(
  `\n✓ Uploaded build ${uploadConfig.buildNumber} to TestFlight (${uploadConfig.bundleId}, ${uploadConfig.displayName}, ${uploadConfig.configuration}` +
    `${uploadConfig.staging ? ' -> dev API' : ' -> production'}).`,
);
console.log('It will appear in App Store Connect after processing (usually 5-15 min).');
