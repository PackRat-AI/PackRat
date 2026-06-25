#!/usr/bin/env bun
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { nodeEnv } from '@packrat/env/node';

type PairDevice = {
  name: string;
  udid: string;
  state: string;
};

type SimulatorPair = {
  watch: PairDevice;
  phone: PairDevice;
  state: string;
};

const REPO_ROOT = resolve(import.meta.dir, '../../..');
const SWIFT_DIR = resolve(REPO_ROOT, 'apps/swift');
const ARTIFACT_DIR = resolve(REPO_ROOT, 'artifacts/screenshots-latest');
const IOS_BUNDLE_ID = 'com.andrewbierman.packrat';
const WATCH_BUNDLE_ID = 'com.andrewbierman.packrat.watchkitapp';
const WAIT_MS = Number(nodeEnv.PACKRAT_WATCH_SYNC_WAIT_MS ?? 45_000);

// biome-ignore lint/complexity/useMaxParams: command wrappers read like shell invocations.
function run(
  command: string,
  args: string[],
  options: { allowFailure?: boolean; env?: NodeJS.ProcessEnv; quiet?: boolean } = {},
) {
  const result = spawnSync(command, args, {
    cwd: SWIFT_DIR,
    env: { ...Bun.env, ...options.env },
    encoding: 'utf8',
    stdio: options.allowFailure || options.quiet ? 'pipe' : 'inherit',
  });
  if (!options.allowFailure && result.status !== 0) {
    const stderr = result.stderr ? `\n${result.stderr.trim()}` : '';
    const stdout = result.stdout ? `\n${result.stdout.trim()}` : '';
    throw new Error(`${command} ${args.join(' ')} failed with ${result.status}${stderr}${stdout}`);
  }
  return result;
}

function output(command: string, args: string[]): string {
  return execFileSync(command, args, {
    cwd: SWIFT_DIR,
    encoding: 'utf8',
    env: Bun.env,
  }).trim();
}

function outputOrNull(command: string, args: string[]): string | null {
  const result = run(command, args, { allowFailure: true });
  return result.status === 0 ? result.stdout.trim() : null;
}

function sleep(ms: number) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function isAppInstalled(deviceId: string, bundleId: string): boolean {
  const result = run('xcrun', ['simctl', 'listapps', deviceId], { allowFailure: true });
  return result.status === 0 && result.stdout.includes(bundleId);
}

// biome-ignore lint/complexity/useMaxParams: timeout belongs with this polling helper.
async function waitForInstalledApp(deviceId: string, bundleId: string, timeoutMs = 20_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (isAppInstalled(deviceId, bundleId)) return;
    await sleep(1_000);
  }
  throw new Error(`${bundleId} was not visible on ${deviceId} after install.`);
}

// biome-ignore lint/complexity/useMaxParams: install retry needs the target device, bundle, and app artifact together.
async function installAppWithRetry(
  deviceId: string,
  bundleId: string,
  appPath: string,
  attempts = 4,
) {
  let lastError = '';
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = run('xcrun', ['simctl', 'install', deviceId, appPath], { allowFailure: true });
    if (result.status !== 0) {
      lastError = [result.stderr, result.stdout].filter(Boolean).join('\n').trim();
    }
    const startedAt = Date.now();
    while (Date.now() - startedAt < 6_000) {
      if (isAppInstalled(deviceId, bundleId)) return;
      await sleep(1_000);
    }
  }
  throw new Error(
    `${bundleId} was not visible on ${deviceId} after ${attempts} install attempts.\n${lastError}`,
  );
}

// biome-ignore lint/complexity/useMaxParams: launch retry needs the device, bundle, and optional launch environment together.
async function launchWithRetry(
  deviceId: string,
  bundleId: string,
  options: { env?: NodeJS.ProcessEnv; attempts?: number; reinstallAppPath?: string } = {},
) {
  const attempts = options.attempts ?? 6;
  let lastError = '';
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (attempt === 3 && options.reinstallAppPath) {
      await installAppWithRetry(deviceId, bundleId, options.reinstallAppPath);
      await waitForInstalledApp(deviceId, bundleId);
    }
    const result = run(
      'xcrun',
      ['simctl', 'launch', '--terminate-running-process', deviceId, bundleId],
      {
        allowFailure: true,
        env: options.env,
      },
    );
    if (result.status === 0) return;
    lastError = [result.stderr, result.stdout].filter(Boolean).join('\n').trim();
    await sleep(2_000);
  }
  throw new Error(
    `Unable to launch ${bundleId} on ${deviceId} after ${attempts} attempts.\n${lastError}`,
  );
}

function activePair(): SimulatorPair {
  const parsed = JSON.parse(output('xcrun', ['simctl', 'list', 'pairs', '-j'])) as {
    pairs: Record<string, SimulatorPair>;
  };
  const pairs = Object.values(parsed.pairs);
  const pair =
    pairs.find(
      (candidate) => candidate.watch.state === 'Booted' && candidate.phone.state === 'Booted',
    ) ?? pairs.find((candidate) => candidate.watch.udid && candidate.phone.udid);
  if (!pair) throw new Error('No paired iPhone + Apple Watch simulator pair is available.');
  return pair;
}

// biome-ignore lint/complexity/useMaxParams: build setting lookup is clearer with explicit xcodebuild dimensions.
function buildSetting(scheme: string, destination: string, key: string): string {
  const settings = output('xcodebuild', [
    '-project',
    'PackRat.xcodeproj',
    '-scheme',
    scheme,
    '-destination',
    destination,
    '-configuration',
    'Debug',
    '-showBuildSettings',
  ]);
  const line = settings
    .split('\n')
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${key} = `));
  if (!line) throw new Error(`Unable to resolve ${key} for ${scheme}`);
  return line.slice(`${key} = `.length);
}

function appPath(scheme: string, destination: string): string {
  const productsDir = buildSetting(scheme, destination, 'BUILT_PRODUCTS_DIR');
  const wrapperName = buildSetting(scheme, destination, 'WRAPPER_NAME');
  return resolve(productsDir, wrapperName);
}

function assertSnapshot(payload: string) {
  const snapshot = JSON.parse(payload) as {
    pack?: { name?: string; checklist?: unknown[]; totalItemCount?: number };
    trip?: { name?: string };
    weather?: { temperatureText?: string };
    trail?: { title?: string };
  };

  if (!snapshot.pack || snapshot.pack.name === 'No Pack Synced') {
    throw new Error(`Watch snapshot did not sync pack data: ${payload}`);
  }
  if (!snapshot.pack.checklist?.length && !snapshot.pack.totalItemCount) {
    throw new Error(`Watch snapshot did not include checklist data: ${payload}`);
  }
  if (!snapshot.trip?.name) throw new Error(`Watch snapshot did not include trip data: ${payload}`);
  if (!snapshot.weather?.temperatureText || snapshot.weather.temperatureText === '--') {
    throw new Error(`Watch snapshot did not include weather data: ${payload}`);
  }
  if (!snapshot.trail?.title)
    throw new Error(`Watch snapshot did not include trail data: ${payload}`);
}

async function waitForWatchSnapshot(watchId: string, timeoutMs: number): Promise<string> {
  const startedAt = Date.now();
  let lastError = '';
  while (Date.now() - startedAt < timeoutMs) {
    const container = outputOrNull('xcrun', [
      'simctl',
      'get_app_container',
      watchId,
      WATCH_BUNDLE_ID,
      'data',
    ]);
    if (container) {
      const preferences = resolve(
        container,
        'Library/Preferences/com.andrewbierman.packrat.watchkitapp.plist',
      );
      const payload = outputOrNull('/usr/libexec/PlistBuddy', [
        '-c',
        'Print :watch.snapshot',
        preferences,
      ]);
      if (payload) {
        try {
          assertSnapshot(payload);
          return payload;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
        }
      }
    }
    await sleep(2_000);
  }
  throw new Error(
    lastError || `Watch snapshot did not appear within ${Math.round(timeoutMs / 1000)}s.`,
  );
}

async function main() {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  const pair = activePair();
  const phoneId = nodeEnv.PACKRAT_WATCH_SYNC_PHONE_ID ?? pair.phone.udid;
  const watchId = nodeEnv.PACKRAT_WATCH_SYNC_WATCH_ID ?? pair.watch.udid;
  const phoneDestination = `platform=iOS Simulator,id=${phoneId}`;
  const watchDestination = `platform=watchOS Simulator,id=${watchId}`;

  console.log(`-> Pair: ${pair.phone.name} (${phoneId}) + ${pair.watch.name} (${watchId})`);
  run('xcrun', ['simctl', 'boot', phoneId], { allowFailure: true });
  run('xcrun', ['simctl', 'boot', watchId], { allowFailure: true });

  console.log('-> Building iOS app with embedded Watch content');
  run(
    'xcodebuild',
    [
      '-project',
      'PackRat.xcodeproj',
      '-scheme',
      'PackRat-iOS',
      '-destination',
      phoneDestination,
      '-configuration',
      'Debug',
      'build',
    ],
    { quiet: true },
  );

  const iosAppPath = appPath('PackRat-iOS', phoneDestination);
  const standaloneWatchAppPath = appPath('PackRat-Watch', watchDestination);
  const embeddedWatchAppPath = resolve(iosAppPath, 'Watch/PackRat-Watch.app');
  if (!existsSync(iosAppPath)) throw new Error(`Missing iOS app at ${iosAppPath}`);
  if (!existsSync(embeddedWatchAppPath))
    throw new Error(`Missing embedded Watch app at ${embeddedWatchAppPath}`);
  if (!existsSync(standaloneWatchAppPath))
    throw new Error(`Missing Watch app at ${standaloneWatchAppPath}`);

  console.log('-> Installing apps');
  run('xcrun', ['simctl', 'uninstall', phoneId, IOS_BUNDLE_ID], { allowFailure: true });
  run('xcrun', ['simctl', 'uninstall', watchId, WATCH_BUNDLE_ID], { allowFailure: true });
  await installAppWithRetry(phoneId, IOS_BUNDLE_ID, iosAppPath);
  await installAppWithRetry(watchId, WATCH_BUNDLE_ID, standaloneWatchAppPath);
  await waitForInstalledApp(phoneId, IOS_BUNDLE_ID);
  await waitForInstalledApp(watchId, WATCH_BUNDLE_ID);

  run('xcrun', ['simctl', 'terminate', phoneId, IOS_BUNDLE_ID], { allowFailure: true });
  run('xcrun', ['simctl', 'terminate', watchId, WATCH_BUNDLE_ID], { allowFailure: true });

  console.log('-> Launching Watch without injected snapshot');
  await launchWithRetry(watchId, WATCH_BUNDLE_ID, {
    env: { SIMCTL_CHILD_PACKRAT_WATCH_RESET_SNAPSHOT: '1' },
    reinstallAppPath: standaloneWatchAppPath,
  });

  console.log('-> Launching iPhone with authenticated visual sample data');
  run(
    'xcrun',
    [
      'simctl',
      'launch',
      '--terminate-running-process',
      phoneId,
      IOS_BUNDLE_ID,
      '--disable-animations',
      '--use-userdefaults-auth',
      '--reset-auth',
      '--seed-e2e-auth',
      '--visual-sample-data',
    ],
    {
      env: {
        SIMCTL_CHILD_PACKRAT_VISUAL_SAMPLE_DATA: '1',
        SIMCTL_CHILD_PACKRAT_E2E_EMAIL: 'e2e@packrat.test',
        SIMCTL_CHILD_PACKRAT_E2E_USER_ID: '00000000-0000-4000-8000-000000000001',
        SIMCTL_CHILD_PACKRAT_E2E_ROLE: 'ADMIN',
      },
    },
  );

  console.log(`-> Waiting ${Math.round(WAIT_MS / 1000)}s for WatchConnectivity`);
  await waitForWatchSnapshot(watchId, WAIT_MS);

  const screenshotPath = resolve(ARTIFACT_DIR, 'watch-real-sync-smoke.png');
  const tempScreenshotPath = `/tmp/packrat-watch-real-sync-smoke-${Date.now()}.png`;
  run('xcrun', ['simctl', 'io', watchId, 'screenshot', tempScreenshotPath]);
  rmSync(screenshotPath, { force: true });
  copyFileSync(tempScreenshotPath, screenshotPath);
  rmSync(tempScreenshotPath, { force: true });
  console.log(`✓ Watch received iPhone snapshot: ${screenshotPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
