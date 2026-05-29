#!/usr/bin/env bun
import { spawn, spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { listBooted } from './lib/simctl';
import { formatSummaryLine, readSummary, type TestSummary, XcResultError } from './lib/xcresult';

type Platform = 'ios' | 'ipad' | 'macos';

type Options = {
  platforms: Platform[];
  outDir: string;
  skipTests: boolean;
};

type ScreenshotRequirement = {
  name: string;
  area: 'auth' | 'crud' | 'ai' | 'navigation' | 'offline-local' | 'modal' | 'data';
  flow: string;
};

type ContactSheetGroup = {
  suffix: string;
  title: string;
  matches: (fileName: string) => boolean;
};

type VisualTestResult = {
  resultBundle: string;
  summary: TestSummary | null;
};

type PlatformRunSummary = {
  platform: Platform;
  screenshotDir: string;
  coverageManifest: string;
  contactSheet: string;
  groupedContactSheets: string[];
  resultBundle?: string;
  testSummary?: TestSummary;
};

const REPO_ROOT = resolve(import.meta.dir, '../../..');
const SWIFT_DIR = resolve(REPO_ROOT, 'apps/swift');
const RESULTS_DIR = resolve(SWIFT_DIR, 'TestResults');
const DEFAULT_OUT_DIR = resolve(REPO_ROOT, 'artifacts/screenshots');
const HTML_ESCAPE_RE = /[&<>"']/g;
const QUOTE_RE = /^["']|["']$/g;
const LEADING_DIGIT_RE = /^\d/;
const SCREENSHOT_PREFIX_RE = /^\d+[a-z]?-/i;
const XCT_ATTACHMENT_SUFFIX_RE = /_\d+_[0-9A-F-]+\.png$/i;
const DATA_DETAIL_SCREENSHOT_RE = /^7[1-9]-data-/;
const SIPS_PIXEL_WIDTH_RE = /pixelWidth:\s*(\d+)/;
const SIPS_PIXEL_HEIGHT_RE = /pixelHeight:\s*(\d+)/;
const XCODEBUILD_TIMEOUT_MS = durationFromEnv('PACKRAT_VISUAL_XCODEBUILD_TIMEOUT_MS', 30 * 60_000);
const XCRESULT_EXPORT_TIMEOUT_MS = durationFromEnv('PACKRAT_XCRESULT_EXPORT_TIMEOUT_MS', 90_000);
const AUTOMATION_MODE_TIMEOUT_MS = 10_000;
const IMAGE_SIZE_TIMEOUT_MS = 5_000;
const PLAYWRIGHT_RENDER_TIMEOUT_MS = durationFromEnv(
  'PACKRAT_PLAYWRIGHT_RENDER_TIMEOUT_MS',
  30_000,
);
const CONTACT_SHEET_RENDER_TIMEOUT_MS = 90_000;
const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
];
const IOS_SURFACES = [
  'packs',
  'trips',
  'assistant',
  'ai-packs',
  'gear-inventory',
  'season-suggestions',
  'pack-templates',
  'guides',
  'catalog',
  'feed',
  'trail-conditions',
  'weather',
  'shopping-list',
  'wildlife',
] as const;
const MAC_SURFACES = [
  'home',
  'packs',
  'trips',
  'weather',
  'assistant',
  'catalog',
  'pack-templates',
  'trail-conditions',
  'feed',
  'guides',
  'gear-inventory',
  'wildlife',
  'ai-packs',
  'season-suggestions',
] as const;
const CONTACT_SHEET_GROUPS: ContactSheetGroup[] = [
  {
    suffix: 'unauth',
    title: 'Unauthenticated Entry',
    matches: (fileName) =>
      fileName.startsWith('00-') ||
      fileName.startsWith('01-') ||
      fileName.startsWith('02-') ||
      fileName.startsWith('02a-'),
  },
  {
    suffix: 'guest',
    title: 'Guest Mode',
    matches: (fileName) =>
      fileName.startsWith('03-') ||
      fileName.startsWith('10-guest-') ||
      fileName.startsWith('50-guest-modal-') ||
      fileName.startsWith('50-guest-limit-'),
  },
  {
    suffix: 'guest-limits',
    title: 'Guest Account Limits',
    matches: (fileName) => fileName.startsWith('50-guest-limit-'),
  },
  {
    suffix: 'offline',
    title: 'Offline and Cached Data',
    matches: (fileName) => fileName.startsWith('4') && fileName.includes('-offline-'),
  },
  {
    suffix: 'auth',
    title: 'Authenticated Empty State',
    matches: (fileName) =>
      fileName.startsWith('20-auth-') ||
      fileName.startsWith('30-auth-') ||
      fileName.startsWith('60-auth-'),
  },
  {
    suffix: 'data',
    title: 'Authenticated Sample Data',
    matches: (fileName) => fileName.startsWith('70-data-') || fileName.startsWith('80-data-'),
  },
  {
    suffix: 'detail',
    title: 'Authenticated Detail Screens',
    matches: (fileName) =>
      DATA_DETAIL_SCREENSHOT_RE.test(fileName) ||
      fileName.startsWith('8') ||
      fileName.startsWith('9'),
  },
  {
    suffix: 'expanded',
    title: 'Expanded Menus, Sheets, and Controls',
    matches: (fileName) => fileName.startsWith('8') || fileName.startsWith('9'),
  },
  {
    suffix: 'modals',
    title: 'Modal and Sheet States',
    matches: (fileName) =>
      fileName.startsWith('50-guest-modal-') ||
      fileName.startsWith('60-auth-modal-') ||
      fileName.startsWith('80-data-modal-'),
  },
];
const COMMON_AUTH_REQUIREMENTS: ScreenshotRequirement[] = [
  requirement('00-unauth-welcome', { area: 'auth', flow: 'Welcome screen' }),
  requirement('01-unauth-register', { area: 'auth', flow: 'Register form' }),
  requirement('02-unauth-login', { area: 'auth', flow: 'Login form with SSO options' }),
  requirement('02a-unauth-forgot-password', { area: 'auth', flow: 'Forgot password form' }),
  requirement('03-guest-home', { area: 'offline-local', flow: 'Guest app shell' }),
  requirement('20-auth-home', { area: 'auth', flow: 'Seeded authenticated shell' }),
  requirement('70-data-home', { area: 'data', flow: 'Authenticated shell with seeded data' }),
  requirement('40-offline-guest-home', { area: 'offline-local', flow: 'Guest offline shell' }),
  requirement('41-offline-auth-home', {
    area: 'offline-local',
    flow: 'Authenticated offline shell',
  }),
  requirement('42-offline-data-home', {
    area: 'offline-local',
    flow: 'Authenticated offline shell with cached sample data',
  }),
  requirement('43-offline-data-packs', {
    area: 'offline-local',
    flow: 'Offline cached packs',
  }),
  requirement('44-offline-data-trips', {
    area: 'offline-local',
    flow: 'Offline cached trips',
  }),
  requirement('45-offline-data-assistant', {
    area: 'offline-local',
    flow: 'Offline assistant cached state',
  }),
  requirement('46-offline-data-weather', {
    area: 'offline-local',
    flow: 'Offline weather cached or connection-needed state',
  }),
];

function usage(): never {
  console.log(`Usage:
  bun swift:screenshots
  bun swift:screenshots --platform ios
  bun swift:screenshots --platform ipad
  bun swift:screenshots --platform macos
  bun swift:screenshots --skip-tests
  bun swift:screenshots --out artifacts/screenshots

Captures guest and authenticated visual surfaces through VisualScreenshotTests and assembles:
  artifacts/screenshots/ios-contact-sheet.png
  artifacts/screenshots/ipad-contact-sheet.png
  artifacts/screenshots/macos-contact-sheet.png`);
  process.exit(0);
}

function parseArgs(argv: readonly string[]): Options {
  let platforms: Platform[] = ['ios', 'ipad', 'macos'];
  let outDir = DEFAULT_OUT_DIR;
  let skipTests = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg) continue;
    if (arg === '--help' || arg === '-h') usage();
    if (arg === '--skip-tests') {
      skipTests = true;
      continue;
    }
    if (arg === '--platform') {
      const value = argv[++i];
      if (!value) throw new Error('--platform requires ios, ipad, macos, or both');
      platforms = parsePlatforms(value);
      continue;
    }
    if (arg.startsWith('--platform=')) {
      platforms = parsePlatforms(arg.slice('--platform='.length));
      continue;
    }
    if (arg === '--out') {
      const value = argv[++i];
      if (!value) throw new Error('--out requires a directory');
      outDir = resolve(REPO_ROOT, value);
      continue;
    }
    if (arg.startsWith('--out=')) {
      outDir = resolve(REPO_ROOT, arg.slice('--out='.length));
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { platforms, outDir, skipTests };
}

function parsePlatforms(value: string): Platform[] {
  const normalized = value.toLowerCase();
  if (normalized === 'both') return ['ios', 'ipad', 'macos'];
  if (normalized === 'ios') return ['ios'];
  if (normalized === 'ipad') return ['ipad'];
  if (normalized === 'macos') return ['macos'];
  throw new Error(`Unknown platform "${value}". Expected ios, ipad, macos, or both.`);
}

function requirement(
  name: string,
  metadata: Omit<ScreenshotRequirement, 'name'>,
): ScreenshotRequirement {
  return { ...metadata, name: `${name}.png` };
}

function durationFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function redactSecrets(output: string): string {
  let redacted = output;
  for (const secret of [
    process.env.E2E_EMAIL,
    process.env.E2E_PASSWORD,
    process.env.E2E_TEST_EMAIL,
    process.env.E2E_TEST_PASSWORD,
    process.env.PACKRAT_E2E_EMAIL,
    process.env.PACKRAT_E2E_PASSWORD,
    process.env.PACKRAT_E2E_SESSION_TOKEN,
    process.env.PACKRAT_E2E_USER_ID,
  ]) {
    if (!secret) continue;
    redacted = redacted.replace(new RegExp(escapeRegExp(secret), 'g'), '[REDACTED]');
  }
  redacted = redacted.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]');
  redacted = redacted.replace(
    /PACKRAT_E2E_(?:EMAIL|PASSWORD|SESSION_TOKEN|USER_ID)=\S+/g,
    (match) => `${match.slice(0, match.indexOf('=') + 1)}[REDACTED]`,
  );
  return redacted;
}

function requiredScreenshots(platform: Platform): ScreenshotRequirement[] {
  const surfaceRequirements =
    platform === 'ios'
      ? IOS_SURFACES.flatMap((surface) => [
          requirement(`10-guest-${surface}-guest`, {
            area: surfaceArea(surface),
            flow: `Guest ${surface}`,
          }),
          requirement(`30-auth-${surface}-auth`, {
            area: surfaceArea(surface),
            flow: `Authenticated ${surface}`,
          }),
          requirement(`70-data-${surface}-data`, {
            area: surfaceArea(surface),
            flow: `Seeded-data ${surface}`,
          }),
        ])
      : MAC_SURFACES.flatMap((surface) => [
          requirement(`10-guest-${surface}-guest`, {
            area: surfaceArea(surface),
            flow: `Guest ${surface}`,
          }),
          requirement(`30-auth-${surface}-auth`, {
            area: surfaceArea(surface),
            flow: `Authenticated ${surface}`,
          }),
          requirement(`70-data-${surface}-data`, {
            area: surfaceArea(surface),
            flow: `Seeded-data ${surface}`,
          }),
        ]);

  const modalRequirements: ScreenshotRequirement[] = [
    ...modalSet('50-guest-modal', false),
    ...modalSet('60-auth-modal', true),
    ...modalSet('80-data-modal', true),
  ];

  const dataDetailRequirements =
    platform === 'ios'
      ? [
          requirement('72-data-pack-detail', { area: 'crud', flow: 'Pack detail with items' }),
          requirement('74-data-trip-detail', { area: 'crud', flow: 'Trip detail' }),
          requirement('76-data-template-detail', { area: 'crud', flow: 'Template detail' }),
          requirement('78-data-trail-condition-detail', {
            area: 'crud',
            flow: 'Trail report detail',
          }),
          requirement('79-data-catalog-results', {
            area: 'data',
            flow: 'Catalog seeded result state',
          }),
          ...expandedStateRequirements(platform),
        ]
      : [
          requirement('71-data-pack-detail', { area: 'crud', flow: 'Pack split-view detail' }),
          requirement('72-data-trip-detail', { area: 'crud', flow: 'Trip split-view detail' }),
          requirement('73-data-template-detail', {
            area: 'crud',
            flow: 'Template split-view detail',
          }),
          requirement('74-data-trail-condition-detail', {
            area: 'crud',
            flow: 'Trail report split-view detail',
          }),
          requirement('76-data-ai-packs-results', {
            area: 'ai',
            flow: 'AI packs generated result state',
          }),
          requirement('77-data-ai-packs-confirm', {
            area: 'ai',
            flow: 'AI packs confirmation dialog',
          }),
          ...expandedStateRequirements(platform),
        ];

  return [
    ...COMMON_AUTH_REQUIREMENTS,
    ...surfaceRequirements,
    ...modalRequirements,
    ...dataDetailRequirements,
  ];
}

function expandedStateRequirements(platform: Platform): ScreenshotRequirement[] {
  const common = [
    requirement('81-data-pack-detail-expanded', {
      area: 'crud',
      flow: 'Pack detail expanded review baseline',
    }),
    requirement('82-data-pack-add-item-sheet', {
      area: 'crud',
      flow: 'Pack item create sheet from pack detail',
    }),
    requirement('83-data-pack-more-menu', {
      area: 'modal',
      flow: 'Pack detail more menu',
    }),
    requirement('84-data-pack-item-detail', {
      area: 'crud',
      flow: 'Pack item detail sheet',
    }),
    requirement('85-data-pack-item-edit-sheet', {
      area: 'crud',
      flow: 'Pack item edit sheet',
    }),
    requirement('86-data-trip-detail-expanded', {
      area: 'crud',
      flow: 'Trip detail expanded review baseline',
    }),
    requirement('87-data-trip-edit-sheet', {
      area: 'crud',
      flow: 'Trip edit sheet',
    }),
    requirement('88-data-template-detail-expanded', {
      area: 'crud',
      flow: 'Template detail expanded review baseline',
    }),
    requirement('89-data-template-apply-sheet', {
      area: 'crud',
      flow: 'Apply template to pack sheet',
    }),
    requirement('90-data-catalog-item-detail', {
      area: 'data',
      flow: 'Catalog item detail sheet',
    }),
    requirement('91-data-catalog-add-to-pack-sheet', {
      area: 'crud',
      flow: 'Add catalog item to pack sheet',
    }),
    requirement('92-data-weather-alerts-sheet', {
      area: 'modal',
      flow: 'Weather alerts sheet with active alert',
    }),
    requirement('93-data-weather-alert-preferences', {
      area: 'modal',
      flow: 'Weather alert preferences controls',
    }),
    requirement('94-data-feed-comments-sheet', {
      area: 'crud',
      flow: 'Feed comments sheet',
    }),
  ];

  if (platform === 'macos' || platform === 'ios' || platform === 'ipad') {
    common.push(
      requirement('95-data-ai-packs-results-sheet', {
        area: 'ai',
        flow: 'Generated AI packs result sheet',
      }),
    );
  }

  return common;
}

function surfaceArea(surface: string): ScreenshotRequirement['area'] {
  if (['assistant', 'season-suggestions', 'wildlife', 'ai-packs'].includes(surface)) return 'ai';
  if (['packs', 'trips', 'pack-templates', 'trail-conditions', 'feed'].includes(surface))
    return 'crud';
  if (surface === 'gear-inventory' || surface === 'shopping-list') return 'offline-local';
  return 'navigation';
}

function modalSet(prefix: string, includesAccountBackedCompose: boolean): ScreenshotRequirement[] {
  const requirements = [
    requirement(`${prefix}-global-search`, {
      area: 'navigation',
      flow: 'Global search presentation',
    }),
    requirement(`${prefix}-new-pack-sheet`, { area: 'crud', flow: 'Pack create form' }),
    requirement(`${prefix}-new-trip-sheet`, { area: 'crud', flow: 'Trip create form' }),
    requirement(`${prefix}-weather-before-alerts`, {
      area: 'modal',
      flow: 'Weather alerts entry state',
    }),
  ];
  if (prefix === '80-data-modal') {
    requirements.push(
      requirement(`${prefix}-global-search-results`, {
        area: 'navigation',
        flow: 'Global search populated results',
      }),
    );
  }
  if (includesAccountBackedCompose) {
    requirements.push(
      requirement(`${prefix}-new-template-sheet`, {
        area: 'crud',
        flow: 'Template create form',
      }),
      requirement(`${prefix}-trail-report-sheet`, {
        area: 'crud',
        flow: 'Trail report create form',
      }),
      requirement(`${prefix}-feed-compose-sheet`, { area: 'crud', flow: 'Feed compose form' }),
    );
  } else {
    requirements.push(
      requirement('50-guest-limit-new-template', {
        area: 'auth',
        flow: 'Guest template create account limit',
      }),
      requirement('50-guest-limit-trail-report', {
        area: 'auth',
        flow: 'Guest trail report account limit',
      }),
    );
  }
  return requirements;
}

function validateScreenshotMatrix(platform: Platform, screenshotDir: string): void {
  const captured = new Set(listScreenshots(screenshotDir).map((file) => basename(file)));
  const required = requiredScreenshots(platform);
  const missing = required.filter((entry) => !captured.has(entry.name));
  writeCoverageManifest({
    platform,
    screenshotDir,
    required,
    captured: [...captured].sort(),
    missing,
  });

  if (missing.length > 0) {
    const lines = missing
      .map((entry) => `  - ${entry.name} (${entry.area}: ${entry.flow})`)
      .join('\n');
    throw new Error(
      `Screenshot capture for ${platform} is incomplete. Missing required CRUD/auth/AI states:\n${lines}`,
    );
  }
}

function writeCoverageManifest({
  platform,
  screenshotDir,
  required,
  captured,
  missing,
}: {
  platform: Platform;
  screenshotDir: string;
  required: ScreenshotRequirement[];
  captured: string[];
  missing: ScreenshotRequirement[];
}): void {
  const manifest = {
    generatedAt: new Date().toISOString(),
    platform,
    screenshotDir,
    summary: {
      required: required.length,
      captured: captured.length,
      missing: missing.length,
    },
    required,
    missing,
    captured,
  };
  writeFileSync(
    resolve(screenshotDir, 'coverage-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

function loadDotEnv(): void {
  loadEnvFile(resolve(REPO_ROOT, '.env.local'));
  loadEnvFile(resolve(REPO_ROOT, 'packages/api/.dev.vars.e2e'));
}

function loadEnvFile(envFile: string): void {
  if (!existsSync(envFile)) return;
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(QUOTE_RE, '');
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function pickIOSDestination(platform: Extract<Platform, 'ios' | 'ipad'>): string {
  if (platform === 'ipad') return pickAvailableIPadDestination();
  try {
    const booted = listBooted();
    if (booted.length > 0) return `platform=iOS Simulator,id=${booted[0]}`;
  } catch {}
  return 'platform=iOS Simulator,name=iPhone 17 Pro';
}

function pickAvailableIPadDestination(): string {
  const result = spawnSync('xcrun', ['simctl', 'list', 'devices', 'available', '-j'], {
    encoding: 'utf8',
    timeout: 10_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.status === 0) {
    try {
      const parsed = JSON.parse(result.stdout) as {
        devices?: Record<string, Array<{ name?: string; udid?: string; isAvailable?: boolean }>>;
      };
      for (const devices of Object.values(parsed.devices ?? {})) {
        const ipad = devices.find((device) => device.isAvailable && device.name?.includes('iPad'));
        if (ipad?.udid) return `platform=iOS Simulator,id=${ipad.udid}`;
      }
    } catch {}
  }
  return 'platform=iOS Simulator,name=iPad Pro 13-inch (M5)';
}

function allocateResultBundle(platform: Platform): string {
  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
  const prefix =
    platform === 'macos' ? 'visual-macOS' : platform === 'ipad' ? 'visual-iPad' : 'visual-iOS';
  const path = resolve(RESULTS_DIR, `${prefix}-${stamp}.xcresult`);
  if (existsSync(path)) rmSync(path, { recursive: true, force: true });
  return path;
}

function runXcodeVisualTest(platform: Platform, screenshotDir: string): Promise<VisualTestResult> {
  const resultBundle = allocateResultBundle(platform);
  const writableScreenshotDir = allocateWritableScreenshotDir(platform);
  const credentials = e2eBuildSettings();
  const commonArgs = [
    'test',
    '-resultBundlePath',
    resultBundle,
    `PACKRAT_SCREENSHOT_DIR=${writableScreenshotDir}`,
  ];
  const args =
    platform === 'ios' || platform === 'ipad'
      ? [
          ...commonArgs,
          '-scheme',
          'PackRat-iOS',
          '-destination',
          pickIOSDestination(platform),
          '-only-testing:PackRatUITests/VisualScreenshotTests',
          ...credentials,
        ]
      : [
          ...commonArgs,
          '-scheme',
          'PackRat-macOS',
          '-destination',
          'platform=macOS,arch=arm64',
          '-only-testing:PackRatMacOSUITests/VisualScreenshotTests',
          'CODE_SIGN_STYLE=Manual',
          'DEVELOPMENT_TEAM=',
          'CODE_SIGN_IDENTITY=-',
          'CODE_SIGNING_ALLOWED=YES',
          'CODE_SIGNING_REQUIRED=NO',
          ...credentials,
        ];

  console.log(`→ Capturing ${platform} screenshots`);
  console.log(`→ Screenshot dir: ${screenshotDir}`);
  console.log(`→ XCTest write dir: ${writableScreenshotDir}`);
  console.log(`→ Result bundle: ${resultBundle}`);

  if (platform === 'macos') assertAutomationModeAvailable();

  return new Promise((resolvePromise, reject) => {
    let timedOut = false;
    let finalized = false;
    const child = spawn('xcodebuild', args, {
      cwd: SWIFT_DIR,
      env: {
        ...process.env,
        PACKRAT_ENV: process.env.PACKRAT_ENV ?? 'local',
        PACKRAT_SCREENSHOT_DIR: writableScreenshotDir,
        PACKRAT_VISUAL_PLATFORM: platform,
      },
    });
    const timeout = setTimeout(() => {
      timedOut = true;
      console.error(
        `xcodebuild timed out after ${Math.round(XCODEBUILD_TIMEOUT_MS / 1000)}s for ${platform}; terminating child process.`,
      );
      child.kill('SIGINT');
      setTimeout(() => {
        if (!child.killed) child.kill('SIGKILL');
      }, 5_000).unref();
    }, XCODEBUILD_TIMEOUT_MS);
    timeout.unref();

    child.stdout.on('data', (chunk) => process.stdout.write(redactSecrets(chunk.toString())));
    child.stderr.on('data', (chunk) => process.stderr.write(redactSecrets(chunk.toString())));
    child.on('error', (err) => {
      if (finalized) return;
      finalized = true;
      clearTimeout(timeout);
      reject(err);
    });
    const finalize = (code: number | null) => {
      if (finalized) return;
      finalized = true;
      clearTimeout(timeout);
      try {
        const summary = summarizeResult(resultBundle);
        copyScreenshots(writableScreenshotDir, screenshotDir);
        if (listScreenshots(screenshotDir).length === 0) {
          exportScreenshotsFromResultBundle(resultBundle, screenshotDir);
        }
        if (code === 0) {
          resolvePromise({ resultBundle, summary });
          return;
        }
      } catch (err) {
        reject(err);
        return;
      }
      if (timedOut) {
        reject(
          new Error(
            `xcodebuild timed out after ${Math.round(XCODEBUILD_TIMEOUT_MS / 1000)}s for ${platform}`,
          ),
        );
      } else {
        reject(new Error(`xcodebuild exited with ${code ?? 'unknown status'} for ${platform}`));
      }
    };
    child.on('exit', finalize);
    child.on('close', finalize);
  });
}

function allocateWritableScreenshotDir(platform: Platform): string {
  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
  const dir = resolve('/tmp', `packrat-${platform}-visual-${stamp}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

function copyScreenshots(fromDir: string, toDir: string): void {
  if (!existsSync(fromDir)) return;
  mkdirSync(toDir, { recursive: true });
  for (const file of readdirSync(fromDir)) {
    if (!file.toLowerCase().endsWith('.png')) continue;
    cpSync(resolve(fromDir, file), resolve(toDir, file), { force: true });
  }
}

function exportScreenshotsFromResultBundle(resultBundle: string, toDir: string): void {
  const exportDir = resolve('/tmp', `packrat-xcresult-attachments-${Date.now()}`);
  rmSync(exportDir, { recursive: true, force: true });
  mkdirSync(exportDir, { recursive: true });

  const result = spawnSync(
    'xcrun',
    ['xcresulttool', 'export', 'attachments', '--path', resultBundle, '--output-path', exportDir],
    { encoding: 'utf8', timeout: XCRESULT_EXPORT_TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024 },
  );

  if (result.status !== 0) {
    console.warn(
      `Warning: failed to export screenshots from xcresult attachments. ${result.stderr || result.stdout}`,
    );
    return;
  }

  const manifestPath = resolve(exportDir, 'manifest.json');
  if (!existsSync(manifestPath)) return;

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as AttachmentManifestEntry[];
  mkdirSync(toDir, { recursive: true });
  for (const entry of manifest) {
    for (const attachment of entry.attachments ?? []) {
      const source = resolve(exportDir, attachment.exportedFileName);
      if (!existsSync(source)) continue;
      const destinationName = stableAttachmentName(attachment.suggestedHumanReadableName);
      if (!destinationName) continue;
      cpSync(source, resolve(toDir, destinationName), { force: true });
    }
  }
}

function stableAttachmentName(suggestedName: string | undefined): string | null {
  if (!suggestedName?.toLowerCase().endsWith('.png')) return null;
  const stable = suggestedName.replace(XCT_ATTACHMENT_SUFFIX_RE, '.png');
  return LEADING_DIGIT_RE.test(stable) ? stable : null;
}

type AttachmentManifestEntry = {
  attachments?: AttachmentManifestAttachment[];
};

type AttachmentManifestAttachment = {
  exportedFileName: string;
  suggestedHumanReadableName?: string;
};

function e2eBuildSettings(): string[] {
  const email = process.env.E2E_TEST_EMAIL ?? process.env.E2E_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD ?? process.env.E2E_PASSWORD;
  if (!email || !password) {
    console.warn(
      'Warning: E2E_EMAIL/E2E_PASSWORD are not set; authenticated screenshot test will be skipped.',
    );
    return [];
  }
  return [`PACKRAT_E2E_EMAIL=${email}`, `PACKRAT_E2E_PASSWORD=${password}`];
}

function assertAutomationModeAvailable(): void {
  const result = spawnSync('automationmodetool', ['help'], {
    encoding: 'utf8',
    timeout: AUTOMATION_MODE_TIMEOUT_MS,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (
    output.includes('Automation Mode is disabled') &&
    !output.includes('DOES NOT REQUIRE user authentication')
  ) {
    throw new Error(
      'macOS Automation Mode is disabled. Run `automationmodetool enable-automationmode-without-authentication` once, then retry.',
    );
  }
}

function summarizeResult(resultBundle: string): TestSummary | null {
  try {
    const summary = readSummary(resultBundle);
    console.log(formatSummaryLine(summary));
    return summary;
  } catch (err) {
    if (err instanceof XcResultError) {
      console.warn(`Warning: ${err.message}`);
      return null;
    } else {
      throw err;
    }
  }
}

function screenshotDirFor(outDir: string, platform: Platform): string {
  return resolve(outDir, `${platform}-xctest`);
}

function contactSheetPathFor({
  outDir,
  platform,
  suffix,
}: {
  outDir: string;
  platform: Platform;
  suffix?: string;
}): string {
  return resolve(outDir, `${platform}-contact-sheet${suffix ? `-${suffix}` : ''}.png`);
}

function platformDisplayName(platform: Platform): string {
  switch (platform) {
    case 'ios':
      return 'iOS';
    case 'ipad':
      return 'iPad';
    case 'macos':
      return 'macOS';
  }
}

function listScreenshots(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.toLowerCase().endsWith('.png'))
    .filter((file) => LEADING_DIGIT_RE.test(file))
    .sort((a, b) => a.localeCompare(b))
    .map((file) => resolve(dir, file));
}

function humanize(filePath: string): string {
  return basename(filePath, '.png')
    .replace(SCREENSHOT_PREFIX_RE, '')
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function escapeHtml(value: string): string {
  return value.replace(HTML_ESCAPE_RE, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return char;
    }
  });
}

function buildHtml({
  images,
  platform,
  title,
}: {
  images: string[];
  platform: Platform;
  title: string;
}): string {
  const isMac = platform === 'macos';
  const cardWidth = isMac ? 520 : 300;
  const cards = images
    .map((image) => {
      const label = humanize(image);
      return `<figure><img src="${pathToFileURL(image).href}" alt="${escapeHtml(label)}"><figcaption>${escapeHtml(label)}</figcaption></figure>`;
    })
    .join('\n');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 32px;
      font: 14px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
      background: #f5f5f7;
      color: #1d1d1f;
    }
    h1 {
      margin: 0 0 20px;
      font-size: 28px;
      line-height: 1.15;
      letter-spacing: 0;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(${cardWidth}px, 1fr));
      gap: 18px;
      align-items: start;
    }
    figure {
      margin: 0;
      padding: 10px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 8px;
      background: white;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }
    img {
      display: block;
      width: 100%;
      height: auto;
      border-radius: 6px;
      border: 1px solid rgba(0, 0, 0, 0.06);
      background: #fff;
    }
    figcaption {
      padding: 8px 2px 0;
      color: #515154;
      font-size: 13px;
      line-height: 1.25;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <main class="grid">${cards}</main>
</body>
</html>`;
}

async function renderContactSheet(platform: Platform, outDir: string): Promise<string> {
  const screenshotDir = screenshotDirFor(outDir, platform);
  const images = listScreenshots(screenshotDir);
  if (images.length === 0) {
    throw new Error(`No named screenshots found in ${screenshotDir}`);
  }

  const htmlPath = resolve(outDir, `${platform}-contact-sheet.html`);
  const outputPath = contactSheetPathFor({ outDir, platform });
  const title = `PackRat ${platformDisplayName(platform)} Screens`;
  writeFileSync(htmlPath, buildHtml({ images, platform, title }));

  await screenshotHtml({
    htmlPath,
    images,
    outputPath,
    platform,
  });

  return outputPath;
}

async function renderGroupedContactSheets(platform: Platform, outDir: string): Promise<string[]> {
  const screenshotDir = screenshotDirFor(outDir, platform);
  const images = listScreenshots(screenshotDir);
  const rendered: string[] = [];

  for (const group of CONTACT_SHEET_GROUPS) {
    const groupImages = images.filter((image) => group.matches(basename(image)));
    if (groupImages.length === 0) continue;

    const htmlPath = resolve(outDir, `${platform}-contact-sheet-${group.suffix}.html`);
    const outputPath = contactSheetPathFor({ outDir, platform, suffix: group.suffix });
    const platformName = platformDisplayName(platform);
    writeFileSync(
      htmlPath,
      buildHtml({
        images: groupImages,
        platform,
        title: `PackRat ${platformName}: ${group.title}`,
      }),
    );
    await screenshotHtml({
      htmlPath,
      images: groupImages,
      outputPath,
      platform,
    });
    rendered.push(outputPath);
  }

  return rendered;
}

async function screenshotHtml({
  htmlPath,
  images,
  outputPath,
  platform,
}: {
  htmlPath: string;
  images: string[];
  outputPath: string;
  platform: Platform;
}): Promise<void> {
  const chrome = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
  if (chrome) {
    renderWithSystemChrome({ chrome, htmlPath, images, outputPath, platform });
    return;
  }

  try {
    const { chromium } = await import('@playwright/test');
    const browser = await chromium.launch({ timeout: PLAYWRIGHT_RENDER_TIMEOUT_MS });
    try {
      const page = await browser.newPage({
        viewport: { width: platform === 'ios' ? 1600 : 1800, height: 1200 },
        deviceScaleFactor: 1,
      });
      await page.goto(pathToFileURL(htmlPath).href);
      await page.screenshot({ path: outputPath, fullPage: true });
      return;
    } finally {
      await browser.close();
    }
  } catch (err) {
    throw new Error(
      `No contact sheet renderer found. System Chrome is unavailable and Playwright failed: ${formatError(err)}`,
    );
  }
}

function renderWithSystemChrome({
  chrome,
  htmlPath,
  images,
  outputPath,
  platform,
}: {
  chrome: string;
  htmlPath: string;
  images: string[];
  outputPath: string;
  platform: Platform;
}): void {
  const width = platform === 'ios' ? 1600 : 1800;
  const height = estimateContactSheetHeight({ images, platform, width });
  const result = spawnSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      `--window-size=${width},${height}`,
      `--screenshot=${outputPath}`,
      pathToFileURL(htmlPath).href,
    ],
    { encoding: 'utf8', timeout: CONTACT_SHEET_RENDER_TIMEOUT_MS },
  );

  if (result.status !== 0) {
    throw new Error(
      `Chrome screenshot failed: ${result.stderr || result.stdout || `exit ${result.status}`}`,
    );
  }
}

function estimateContactSheetHeight({
  images,
  platform,
  width,
}: {
  images: string[];
  platform: Platform;
  width: number;
}): number {
  const horizontalPadding = 64;
  const gridGap = 18;
  const cardWidth = platform === 'ios' ? 300 : 520;
  const columns = Math.max(
    1,
    Math.floor((width - horizontalPadding + gridGap) / (cardWidth + gridGap)),
  );
  const cardHeights = images.map((image) => {
    const size = readImageSize(image);
    if (!size) return platform === 'ios' ? 720 : 420;
    return Math.ceil((size.height / size.width) * cardWidth) + 42;
  });
  const rows: number[] = [];
  for (let index = 0; index < cardHeights.length; index += columns) {
    rows.push(Math.max(...cardHeights.slice(index, index + columns)));
  }
  return Math.max(1200, 116 + rows.reduce((sum, row) => sum + row, 0) + gridGap * rows.length);
}

function readImageSize(image: string): { width: number; height: number } | null {
  const result = spawnSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', image], {
    encoding: 'utf8',
    timeout: IMAGE_SIZE_TIMEOUT_MS,
  });
  if (result.status !== 0) return null;
  const width = result.stdout.match(SIPS_PIXEL_WIDTH_RE)?.[1];
  const height = result.stdout.match(SIPS_PIXEL_HEIGHT_RE)?.[1];
  if (!width || !height) return null;
  return { width: Number(width), height: Number(height) };
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function main() {
  loadDotEnv();
  const options = parseArgs(process.argv.slice(2));
  mkdirSync(options.outDir, { recursive: true });
  const runSummary: PlatformRunSummary[] = [];

  for (const platform of options.platforms) {
    const dir = screenshotDirFor(options.outDir, platform);
    let testResult: VisualTestResult | null = null;
    mkdirSync(dir, { recursive: true });
    if (!options.skipTests) {
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      testResult = await runXcodeVisualTest(platform, dir);
    }
    validateScreenshotMatrix(platform, dir);
    const contactSheet = await renderContactSheet(platform, options.outDir);
    const groupedContactSheets = await renderGroupedContactSheets(platform, options.outDir);
    const coverageManifest = resolve(dir, 'coverage-manifest.json');
    runSummary.push({
      platform,
      screenshotDir: dir,
      coverageManifest,
      contactSheet,
      groupedContactSheets,
      ...(testResult
        ? {
            resultBundle: testResult.resultBundle,
            ...(testResult.summary ? { testSummary: testResult.summary } : {}),
          }
        : {}),
    });
    console.log(`✓ ${platform} contact sheet: ${contactSheet}`);
    for (const groupedContactSheet of groupedContactSheets) {
      console.log(`✓ ${platform} grouped contact sheet: ${groupedContactSheet}`);
    }
    console.log(`✓ ${platform} coverage manifest: ${coverageManifest}`);
  }

  const runSummaryPath = resolve(options.outDir, 'run-summary.json');
  writeFileSync(
    runSummaryPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        skipTests: options.skipTests,
        platforms: runSummary,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`✓ screenshot run summary: ${runSummaryPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
