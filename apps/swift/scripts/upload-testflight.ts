#!/usr/bin/env bun
/**
 * Archive the native Swift PackRat iOS app and upload it to TestFlight.
 *
 * This targets a SEPARATE App Store Connect record from the production Expo
 * app: bundle id `com.andrewbierman.packrat.swift`. Register that app record
 * in App Store Connect once before the first upload.
 *
 * Auth uses an Apple ID + app-specific password (no App Store Connect API key
 * required). Generate a password at appleid.apple.com -> Sign-In & Security ->
 * App-Specific Passwords.
 *
 * Required env (put in apps/swift/.env.local, gitignored):
 *   APPLE_ID                 your Apple ID email
 *   APPLE_APP_PASSWORD       app-specific password (xxxx-xxxx-xxxx-xxxx)
 *   APPLE_TEAM_ID            the team that owns the record (e.g. 7WV9JYCW55)
 *
 * Optional env:
 *   BUILD_NUMBER             CFBundleVersion for this upload (default: timestamp)
 *
 * Usage:
 *   bun apps/swift/scripts/upload-testflight.ts
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SWIFT_DIR = new URL('..', import.meta.url).pathname;
const PROJECT = join(SWIFT_DIR, 'PackRat.xcodeproj');
const SCHEME = 'PackRat-iOS';
const BUNDLE_ID = 'com.andrewbierman.packrat.swift';

function req(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}. See script header.`);
    process.exit(1);
  }
  return v;
}

const appleId = req('APPLE_ID');
const appPassword = req('APPLE_APP_PASSWORD');
const teamId = req('APPLE_TEAM_ID');
const buildNumber = process.env.BUILD_NUMBER ?? String(Math.floor(Date.now() / 1000));

const work = mkdtempSync(join(tmpdir(), 'packrat-tf-'));
const archivePath = join(work, 'PackRat.xcarchive');
const exportDir = join(work, 'export');

function run(cmd: string, args: string[]) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { stdio: 'inherit' });
}

// 1. Archive for a real device (TestFlight cannot accept a simulator build).
run('xcodebuild', [
  'archive',
  '-project',
  PROJECT,
  '-scheme',
  SCHEME,
  '-destination',
  'generic/platform=iOS',
  '-archivePath',
  archivePath,
  // Lets Xcode register the App IDs and generate provisioning profiles for
  // the (new) bundle ids on the fly, using the signed-in account.
  '-allowProvisioningUpdates',
  `CURRENT_PROJECT_VERSION=${buildNumber}`,
  `DEVELOPMENT_TEAM=${teamId}`,
]);

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

run('xcodebuild', [
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
]);

// 3. Upload to TestFlight via altool (app-specific-password auth).
// `--asc-provider` (team short name) is required when the Apple ID belongs to
// more than one team, so altool knows which one to deliver to.
const ipa = join(exportDir, 'PackRat-iOS.ipa');
run('xcrun', [
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
  teamId,
]);

console.log(`\n✓ Uploaded build ${buildNumber} to TestFlight (${BUNDLE_ID}).`);
console.log('It will appear in App Store Connect after processing (usually 5-15 min).');
