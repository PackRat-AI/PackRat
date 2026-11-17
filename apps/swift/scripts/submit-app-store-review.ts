#!/usr/bin/env bun
/**
 * Submit an uploaded build for App Store review.
 *
 * Waits for the build to finish processing, creates (or reuses) the App Store
 * version record, attaches the build, sets release notes, and submits. The
 * version releases automatically once Apple approves it.
 *
 * Usage:
 *   bun apps/swift/scripts/submit-app-store-review.ts \
 *     --platform IOS|MAC_OS --version 2.2.4 --build 2026102101 \
 *     [--whats-new "Bug fixes and improvements."]
 *
 * Required env:
 *   APPLE_ASC_API_KEY_ID     App Store Connect API key id
 *   APPLE_ASC_API_ISSUER_ID  App Store Connect API issuer id
 *   APPLE_ASC_API_KEY_PATH   Path to AuthKey_<id>.p8 (default:
 *                            ~/.appstoreconnect/private_keys/AuthKey_<id>.p8)
 *   ASC_APP_ID               App Store Connect app id (default: 6499243187)
 */

import { parseArgs } from 'node:util';
import { createAscClient, one, resources } from './lib/asc-api';

const { values } = parseArgs({
  options: {
    platform: { type: 'string' },
    version: { type: 'string' },
    build: { type: 'string' },
    'whats-new': { type: 'string', default: 'Bug fixes and improvements.' },
  },
});

const platform = values.platform;
const versionString = values.version;
const buildNumber = values.build;
const whatsNew = values['whats-new'] ?? 'Bug fixes and improvements.';
if (!platform || !['IOS', 'MAC_OS'].includes(platform) || !versionString || !buildNumber) {
  console.error('Usage: --platform IOS|MAC_OS --version <x.y.z> --build <number>');
  process.exit(1);
}

const { appId, api, get } = createAscClient();

// 1. Wait for the build to finish processing (up to 45 minutes).
let build: Resource | undefined;
for (let i = 0; i < 90; i++) {
  const doc = await get(
    `/v1/builds?filter[app]=${appId}&filter[version]=${buildNumber}` +
      `&filter[preReleaseVersion.platform]=${platform}&fields[builds]=processingState`,
  );
  build = resources(doc)[0];
  const state = build?.attributes?.processingState;
  console.log(`build ${buildNumber} (${platform}): ${state ?? 'not visible yet'}`);
  if (state === 'VALID') break;
  if (state === 'FAILED' || state === 'INVALID')
    throw new Error(`Build ${buildNumber} is ${state}`);
  await Bun.sleep(30000);
}
if (!build || build.attributes?.processingState !== 'VALID') {
  throw new Error(`Build ${buildNumber} did not finish processing`);
}

// 2. Find or create the version record.
let version: Resource | undefined = resources(
  await get(
    `/v1/apps/${appId}/appStoreVersions?filter[platform]=${platform}` +
      `&filter[versionString]=${versionString}&fields[appStoreVersions]=appStoreState`,
  ),
)[0];
if (!version) {
  version =
    one(
      await api({
        method: 'POST',
        path: '/v1/appStoreVersions',
        body: {
          data: {
            type: 'appStoreVersions',
            attributes: { platform, versionString, releaseType: 'AFTER_APPROVAL' },
            relationships: { app: { data: { type: 'apps', id: appId } } },
          },
        },
      }),
    ) ?? undefined;
}
if (!version) throw new Error(`Could not create ${platform} ${versionString}`);
const versionState = version.attributes?.appStoreState;
console.log(`version ${versionString} (${platform}): ${version.id} ${versionState ?? ''}`);

// Only an editable version can take a build; anything else is already submitted or shipped.
const EDITABLE_STATES = Object.freeze([
  'PREPARE_FOR_SUBMISSION',
  'DEVELOPER_REJECTED',
  'REJECTED',
  'METADATA_REJECTED',
] as const);
if (versionState && !(EDITABLE_STATES as readonly unknown[]).includes(versionState)) {
  console.log(`✓ ${platform} ${versionString} is already ${versionState}; nothing to submit.`);
  process.exit(0);
}

// 3. Attach the build. The PATCH can 204 without attaching on a fresh version
//    record, so read it back via the sub-resource and retry until it sticks.
const attached = async () => one(await get(`/v1/appStoreVersions/${version.id}/build`))?.id;
for (let i = 0; i < 10 && (await attached()) !== build.id; i++) {
  await api({
    method: 'PATCH',
    path: `/v1/appStoreVersions/${version.id}/relationships/build`,
    body: {
      data: { type: 'builds', id: build.id },
    },
  });
  await Bun.sleep(20000);
}
if ((await attached()) !== build.id) throw new Error('Build did not attach to the version');
console.log('build attached');

// 4. Release notes for every locale.
const locales = await get(`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`);
for (const loc of resources(locales)) {
  await api({
    method: 'PATCH',
    path: `/v1/appStoreVersionLocalizations/${loc.id}`,
    body: {
      data: { type: 'appStoreVersionLocalizations', id: loc.id, attributes: { whatsNew } },
    },
  });
}

// 5. Submit for review, reusing an open draft submission if one exists.
const draft = resources(
  await get(
    `/v1/apps/${appId}/reviewSubmissions?filter[platform]=${platform}` +
      '&filter[state]=READY_FOR_REVIEW&fields[reviewSubmissions]=state',
  ),
)[0];
const submission =
  draft ??
  one(
    await api({
      method: 'POST',
      path: '/v1/reviewSubmissions',
      body: {
        data: {
          type: 'reviewSubmissions',
          attributes: { platform },
          relationships: { app: { data: { type: 'apps', id: appId } } },
        },
      },
    }),
  );
if (!submission) throw new Error('Could not create review submission');
await api({
  method: 'POST',
  path: '/v1/reviewSubmissionItems',
  body: {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: { data: { type: 'reviewSubmissions', id: submission.id } },
        appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } },
      },
    },
  },
});
const submitted = one(
  await api({
    method: 'PATCH',
    path: `/v1/reviewSubmissions/${submission.id}`,
    body: {
      data: { type: 'reviewSubmissions', id: submission.id, attributes: { submitted: true } },
    },
  }),
);
console.log(`✓ ${platform} ${versionString} (${buildNumber}): ${submitted?.attributes?.state}`);
