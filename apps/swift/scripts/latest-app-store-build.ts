#!/usr/bin/env bun
/**
 * Print the highest build number App Store Connect already holds for a
 * platform. The release workflow feeds it to upload-testflight.ts as
 * APP_STORE_CURRENT_BUILD_NUMBER so the upload preflight can confirm the new
 * build outranks it.
 *
 * Usage:
 *   bun apps/swift/scripts/latest-app-store-build.ts [--platform IOS|MAC_OS]
 *
 * Env: see lib/asc-api.ts.
 */

import { parseArgs } from 'node:util';
import { createAscClient, resources } from './lib/asc-api';

const { values } = parseArgs({
  options: { platform: { type: 'string', default: 'IOS' } },
});

const DIGITS = /^\d+$/;

const platform = values.platform ?? 'IOS';
if (!['IOS', 'MAC_OS'].includes(platform)) {
  console.error('Usage: [--platform IOS|MAC_OS]');
  process.exit(1);
}

const { appId, get } = createAscClient();

const doc = await get(
  `/v1/builds?filter[app]=${appId}&filter[preReleaseVersion.platform]=${platform}` +
    '&sort=-uploadedDate&limit=200&fields[builds]=version',
);

// Sort by upload date, then take the numeric max: hand-set and date-style
// build numbers have both been uploaded, so the newest is not always the highest.
const latest = resources(doc)
  .map((build) => String(build.attributes?.version ?? ''))
  .filter((version) => DIGITS.test(version))
  .reduce((max, version) => (BigInt(version) > BigInt(max) ? version : max), '0');

if (latest === '0') {
  console.error(`No ${platform} builds found for app ${appId}.`);
  process.exit(1);
}

console.log(latest);
