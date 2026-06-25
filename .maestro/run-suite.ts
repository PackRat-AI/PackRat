import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeEnv } from '@packrat/env/node';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '..');

const [platformArg = 'android', ...maestroArgs] = Bun.argv.slice(2);
if (platformArg !== 'ios' && platformArg !== 'android') {
  console.error("ERROR: first argument must be 'ios' or 'android' (default: android)");
  process.exit(1);
}

if (!nodeEnv.TEST_EMAIL || !nodeEnv.TEST_PASSWORD) {
  console.error('ERROR: TEST_EMAIL and TEST_PASSWORD must be set');
  process.exit(1);
}

const platform = platformArg as 'ios' | 'android';
const uniqueId = Math.floor(Date.now() / 1000);

function dateOffset(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function monthName(date: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(date);
}

function day(date: Date) {
  return platform === 'android'
    ? String(date.getUTCDate()).padStart(2, '0')
    : String(date.getUTCDate());
}

function year(date: Date) {
  return String(date.getUTCFullYear());
}

function todayLabel() {
  const d = new Date();
  if (platform === 'ios') {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
  }
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

const startDate = dateOffset(7);
const endDate = dateOffset(14);
const today = new Date();
const startTaps =
  (startDate.getUTCFullYear() - today.getFullYear()) * 12 +
  (startDate.getUTCMonth() + 1 - (today.getMonth() + 1));
const endTaps =
  (endDate.getUTCFullYear() - today.getFullYear()) * 12 +
  (endDate.getUTCMonth() + 1 - (today.getMonth() + 1));

const configFile =
  platform === 'ios'
    ? resolve(rootDir, '.maestro/config.yaml')
    : resolve(rootDir, '.maestro/config-android.yaml');
const masterFlow =
  platform === 'ios'
    ? resolve(rootDir, '.maestro/master-flow.yaml')
    : resolve(rootDir, '.maestro/master-flow-android.yaml');
const defaultAppId =
  platform === 'ios' ? 'com.andrewbierman.packrat.preview' : 'com.packratai.mobile.preview';

const envArgs = [
  '-e',
  `TEST_EMAIL=${nodeEnv.TEST_EMAIL}`,
  '-e',
  `TEST_PASSWORD=${nodeEnv.TEST_PASSWORD}`,
  '-e',
  `METRO_HOST=${nodeEnv.METRO_HOST ?? nodeEnv.DEFAULT_METRO_HOST ?? 'localhost'}`,
  '-e',
  `METRO_PORT=${nodeEnv.METRO_PORT ?? '8083'}`,
  '-e',
  `TRIP_NAME=${nodeEnv.TRIP_NAME ?? `E2E-Trip-${uniqueId}`}`,
  '-e',
  `PACK_NAME=${nodeEnv.PACK_NAME ?? `E2E-Pack-${uniqueId}`}`,
  '-e',
  `APP_ID=${nodeEnv.APP_ID ?? defaultAppId}`,
  '-e',
  `START_YEAR=${year(startDate)}`,
  '-e',
  `START_MONTH=${monthName(startDate)}`,
  '-e',
  `START_DAY=${day(startDate)}`,
  '-e',
  `START_TAPS=${startTaps}`,
  '-e',
  `END_YEAR=${year(endDate)}`,
  '-e',
  `END_MONTH=${monthName(endDate)}`,
  '-e',
  `END_DAY=${day(endDate)}`,
  '-e',
  `END_TAPS=${endTaps}`,
  '-e',
  `TODAY_DATE=${todayLabel()}`,
];

const child = Bun.spawn(
  ['maestro', 'test', '--config', configFile, ...maestroArgs, ...envArgs, masterFlow],
  {
    stdout: 'inherit',
    stderr: 'inherit',
  },
);
process.exit(await child.exited);
