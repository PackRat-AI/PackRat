#!/usr/bin/env bun
/**
 * Archive the native Swift PackRat app (iOS or macOS) and upload it to TestFlight.
 *
 * iOS targets a SEPARATE App Store Connect record from the production Expo
 * app: bundle id `com.andrewbierman.packrat.swift`. Register that app record
 * in App Store Connect once before the first upload.
 *
 * macOS (--mac) targets the PRODUCTION record `com.andrewbierman.packrat` —
 * the same one the Expo iPhone app ships from. A single record can host both
 * an iOS and a macOS platform, so Mac testers get the build under TestFlight's
 * macOS tab. The macOS platform must be added to that record in App Store
 * Connect before the first Mac upload.
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
 * Flags:
 *   --staging                Archive the Staging config (PACKRAT_ENV=dev) so the
 *                            TestFlight build targets the deployed DEV API instead
 *                            of production. Default (no flag) = Release/production.
 *   --mac                    Archive the macOS app instead of iOS. Always Release
 *                            (the macOS target has no Staging scheme), so this
 *                            cannot be combined with --staging.
 *
 * Usage:
 *   bun apps/swift/scripts/upload-testflight.ts            # iOS, production
 *   bun apps/swift/scripts/upload-testflight.ts --staging  # iOS, dev API
 *   bun apps/swift/scripts/upload-testflight.ts --mac      # macOS, production
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SWIFT_DIR = new URL('..', import.meta.url).pathname;
const PROJECT = join(SWIFT_DIR, 'PackRat.xcodeproj');

// --mac archives the native macOS app instead of iOS. It ships under the
// production `com.andrewbierman.packrat` App Store Connect record (the same
// record the Expo iPhone app uses) — one record hosts both platforms, so Mac
// testers find it under the macOS tab. iOS uploads still go to the separate
// `.swift` record.
const MAC = process.argv.includes('--mac');
const BUNDLE_ID = MAC ? 'com.andrewbierman.packrat' : 'com.andrewbierman.packrat.swift';

// --staging archives the Staging config (PACKRAT_ENV=dev) via the dedicated
// scheme; the default archives PackRat-iOS (Release config → production).
// The macOS target has no Staging scheme, so --mac always builds Release.
const STAGING = process.argv.includes('--staging');
if (MAC && STAGING) {
  console.error('--staging is not supported with --mac (no macOS Staging scheme).');
  process.exit(1);
}
const SCHEME = MAC ? 'PackRat-macOS' : STAGING ? 'PackRat-iOS-Staging' : 'PackRat-iOS';
const CONFIGURATION = STAGING ? 'Staging' : 'Release';

// TestFlight rejects simulator builds; macOS archives target the host arch.
const DESTINATION = MAC ? 'generic/platform=macOS' : 'generic/platform=iOS';
// altool's --type discriminates the delivery target; macOS uses `osx`.
const ALTOOL_TYPE = MAC ? 'osx' : 'ios';

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
  '-configuration',
  CONFIGURATION,
  '-destination',
  DESTINATION,
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
// A macOS app-store-connect export produces a signed .pkg installer; iOS
// produces an .ipa. Resolve by extension rather than assuming the scheme name
// matches the artifact name.
const artifact = (() => {
  const wanted = MAC ? '.pkg' : '.ipa';
  const found = readdirSync(exportDir).find((f) => f.endsWith(wanted));
  if (!found) {
    console.error(`No ${wanted} found in ${exportDir}. Contents: ${readdirSync(exportDir)}`);
    process.exit(1);
  }
  return join(exportDir, found);
})();

run('xcrun', [
  'altool',
  '--upload-app',
  '--type',
  ALTOOL_TYPE,
  '--file',
  artifact,
  '--username',
  appleId,
  '--password',
  appPassword,
  // This Apple ID belongs to multiple teams, so altool needs the provider
  // disambiguated. --asc-provider takes the team short name / team id.
  '--asc-provider',
  teamId,
]);

console.log(
  `\n✓ Uploaded build ${buildNumber} to TestFlight (${MAC ? 'macOS' : 'iOS'}, ${BUNDLE_ID}, ` +
    `${CONFIGURATION}${STAGING ? ' → dev API' : ' → production'}).`,
);
console.log('It will appear in App Store Connect after processing (usually 5-15 min).');
