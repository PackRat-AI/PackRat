import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import type { TestFlightUploadConfig } from './testflight-config';

type PlistValue = string | boolean | number | null;
type Plist = Record<string, PlistValue>;

export type TestFlightBinaryVerification = {
  ok: boolean;
  errors: string[];
  iosApp: string | null;
  watchApp: string | null;
};

function xmlUnescape(value: string): string {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&gt;', '>')
    .replaceAll('&lt;', '<')
    .replaceAll('&amp;', '&');
}

function parseXmlPlistStrings(xml: string): Plist {
  const result: Plist = {};
  const pattern =
    /<key>([^<]+)<\/key>\s*(?:<string>([\s\S]*?)<\/string>|<integer>([\s\S]*?)<\/integer>|<(true|false)\/>)/g;
  for (const match of xml.matchAll(pattern)) {
    const key = xmlUnescape(match[1]);
    if (match[2] !== undefined) result[key] = xmlUnescape(match[2]);
    else if (match[3] !== undefined) result[key] = Number(match[3]);
    else result[key] = match[4] === 'true';
  }
  return result;
}

function readPlist(path: string): Plist {
  try {
    return JSON.parse(
      execFileSync('plutil', ['-convert', 'json', '-o', '-', path], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    );
  } catch {
    return parseXmlPlistStrings(readFileSync(path, 'utf8'));
  }
}

function findAppBundles(root: string): string[] {
  if (!existsSync(root)) return [];
  const entries = readdirSync(root).map((entry) => join(root, entry));
  const apps: string[] = [];
  for (const entry of entries) {
    const stats = statSync(entry);
    if (!stats.isDirectory()) continue;
    if (entry.endsWith('.app') && existsSync(join(entry, 'Info.plist'))) {
      apps.push(entry);
      continue;
    }
    apps.push(...findAppBundles(entry));
  }
  return apps;
}

function plistString(input: { plist: Plist; key: string }): string {
  const { plist, key } = input;
  const value = plist[key];
  return typeof value === 'string' ? value : String(value ?? '');
}

function expectEqual(input: { errors: string[]; label: string; actual: string; expected: string }) {
  const { errors, label, actual, expected } = input;
  if (actual !== expected)
    errors.push(`${label}: expected ${expected}, got ${actual || '<empty>'}.`);
}

function verifyAppBundles(input: {
  root: string;
  config: TestFlightUploadConfig;
}): TestFlightBinaryVerification {
  const { root, config } = input;
  const errors: string[] = [];
  const apps = findAppBundles(root);
  const iosApp =
    apps.find(
      (app) => !app.includes('/Watch/') && basename(app).toLowerCase().includes('packrat'),
    ) ??
    apps.find((app) => !app.includes('/Watch/')) ??
    null;

  if (!iosApp) {
    return {
      ok: false,
      errors: ['Could not find iOS .app bundle in archive/export.'],
      iosApp,
      watchApp: null,
    };
  }

  const iosPlist = readPlist(join(iosApp, 'Info.plist'));
  expectEqual({
    errors,
    label: 'iOS bundle id',
    actual: plistString({ plist: iosPlist, key: 'CFBundleIdentifier' }),
    expected: config.bundleId,
  });
  expectEqual({
    errors,
    label: 'iOS display name',
    actual: plistString({ plist: iosPlist, key: 'CFBundleDisplayName' }),
    expected: config.displayName,
  });
  expectEqual({
    errors,
    label: 'iOS build number',
    actual: plistString({ plist: iosPlist, key: 'CFBundleVersion' }),
    expected: config.buildNumber,
  });
  expectEqual({
    errors,
    label: 'iOS API environment',
    actual: plistString({ plist: iosPlist, key: 'PACKRAT_ENV' }),
    expected: config.apiEnvironment,
  });

  const watchApp = findAppBundles(join(iosApp, 'Watch')).at(0) ?? null;
  if (!watchApp) {
    errors.push('Could not find embedded watchOS .app bundle.');
  } else {
    const watchPlist = readPlist(join(watchApp, 'Info.plist'));
    expectEqual({
      errors,
      label: 'watchOS bundle id',
      actual: plistString({ plist: watchPlist, key: 'CFBundleIdentifier' }),
      expected: config.watchBundleId,
    });
    expectEqual({
      errors,
      label: 'watchOS companion bundle id',
      actual: plistString({ plist: watchPlist, key: 'WKCompanionAppBundleIdentifier' }),
      expected: config.companionBundleId,
    });
    expectEqual({
      errors,
      label: 'watchOS display name',
      actual: plistString({ plist: watchPlist, key: 'CFBundleDisplayName' }),
      expected: config.displayName,
    });
    expectEqual({
      errors,
      label: 'watchOS build number',
      actual: plistString({ plist: watchPlist, key: 'CFBundleVersion' }),
      expected: config.buildNumber,
    });
  }

  return { ok: errors.length === 0, errors, iosApp, watchApp };
}

export function verifyTestFlightArchive(input: {
  archivePath: string;
  config: TestFlightUploadConfig;
}): TestFlightBinaryVerification {
  return verifyAppBundles({
    root: join(input.archivePath, 'Products', 'Applications'),
    config: input.config,
  });
}

export function verifyTestFlightIPA(input: {
  ipaPath: string;
  config: TestFlightUploadConfig;
}): TestFlightBinaryVerification {
  const work = mkdtempSync(join(tmpdir(), 'packrat-ipa-verify-'));
  try {
    execFileSync('unzip', ['-q', input.ipaPath, '-d', work], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    return verifyAppBundles({ root: join(work, 'Payload'), config: input.config });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
