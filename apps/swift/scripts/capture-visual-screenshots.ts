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
import { formatSummaryLine, readSummary, XcResultError } from './lib/xcresult';

type Platform = 'ios' | 'macos';

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
];

function usage(): never {
  console.log(`Usage:
  bun swift:screenshots
  bun swift:screenshots --platform ios
  bun swift:screenshots --platform macos
  bun swift:screenshots --skip-tests
  bun swift:screenshots --out artifacts/screenshots

Captures guest and authenticated visual surfaces through VisualScreenshotTests and assembles:
  artifacts/screenshots/ios-contact-sheet.png
  artifacts/screenshots/macos-contact-sheet.png`);
  process.exit(0);
}

function parseArgs(argv: readonly string[]): Options {
  let platforms: Platform[] = ['ios', 'macos'];
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
      if (!value) throw new Error('--platform requires ios, macos, or both');
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
  if (normalized === 'both') return ['ios', 'macos'];
  if (normalized === 'ios') return ['ios'];
  if (normalized === 'macos') return ['macos'];
  throw new Error(`Unknown platform "${value}". Expected ios, macos, or both.`);
}

function requirement(
  name: string,
  metadata: Omit<ScreenshotRequirement, 'name'>,
): ScreenshotRequirement {
  return { ...metadata, name: `${name}.png` };
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

  if (platform === 'macos') {
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

function pickIOSDestination(): string {
  try {
    const booted = listBooted();
    if (booted.length > 0) return `platform=iOS Simulator,id=${booted[0]}`;
  } catch {}
  return 'platform=iOS Simulator,name=iPhone 17 Pro';
}

function allocateResultBundle(platform: Platform): string {
  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
  const prefix = platform === 'ios' ? 'visual-iOS' : 'visual-macOS';
  const path = resolve(RESULTS_DIR, `${prefix}-${stamp}.xcresult`);
  if (existsSync(path)) rmSync(path, { recursive: true, force: true });
  return path;
}

function runXcodeVisualTest(platform: Platform, screenshotDir: string): Promise<void> {
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
    platform === 'ios'
      ? [
          ...commonArgs,
          '-scheme',
          'PackRat-iOS',
          '-destination',
          pickIOSDestination(),
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
    const child = spawn('xcodebuild', args, {
      cwd: SWIFT_DIR,
      env: {
        ...process.env,
        PACKRAT_ENV: process.env.PACKRAT_ENV ?? 'local',
        PACKRAT_SCREENSHOT_DIR: writableScreenshotDir,
      },
    });

    child.stdout.on('data', (chunk) => process.stdout.write(chunk));
    child.stderr.on('data', (chunk) => process.stderr.write(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      summarizeResult(resultBundle);
      copyScreenshots(writableScreenshotDir, screenshotDir);
      if (listScreenshots(screenshotDir).length === 0) {
        exportScreenshotsFromResultBundle(resultBundle, screenshotDir);
      }
      if (code === 0) {
        resolvePromise();
      } else {
        reject(new Error(`xcodebuild exited with ${code ?? 'unknown status'} for ${platform}`));
      }
    });
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
    { encoding: 'utf8' },
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
  const result = spawnSync('automationmodetool', ['help'], { encoding: 'utf8' });
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

function summarizeResult(resultBundle: string): void {
  try {
    console.log(formatSummaryLine(readSummary(resultBundle)));
  } catch (err) {
    if (err instanceof XcResultError) {
      console.warn(`Warning: ${err.message}`);
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
  const title = platform === 'ios' ? 'PackRat iOS Screens' : 'PackRat macOS Screens';
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
    const platformName = platform === 'ios' ? 'iOS' : 'macOS';
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
  try {
    const { chromium } = await import('@playwright/test');
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({
        viewport: { width: platform === 'macos' ? 1800 : 1600, height: 1200 },
        deviceScaleFactor: 1,
      });
      await page.goto(pathToFileURL(htmlPath).href);
      await page.screenshot({ path: outputPath, fullPage: true });
      return;
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.warn(
      `Playwright screenshot unavailable; falling back to system Chrome. ${formatError(err)}`,
    );
  }

  const chrome = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!chrome) {
    throw new Error(
      `No browser renderer found. Open ${htmlPath} manually, or run \`bunx playwright install chromium\`.`,
    );
  }

  const width = platform === 'macos' ? 1800 : 1600;
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
    { encoding: 'utf8' },
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
  const cardWidth = platform === 'macos' ? 520 : 300;
  const columns = Math.max(
    1,
    Math.floor((width - horizontalPadding + gridGap) / (cardWidth + gridGap)),
  );
  const cardHeights = images.map((image) => {
    const size = readImageSize(image);
    if (!size) return platform === 'macos' ? 420 : 720;
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

  for (const platform of options.platforms) {
    const dir = screenshotDirFor(options.outDir, platform);
    mkdirSync(dir, { recursive: true });
    if (!options.skipTests) {
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      await runXcodeVisualTest(platform, dir);
    }
    validateScreenshotMatrix(platform, dir);
    const contactSheet = await renderContactSheet(platform, options.outDir);
    const groupedContactSheets = await renderGroupedContactSheets(platform, options.outDir);
    console.log(`✓ ${platform} contact sheet: ${contactSheet}`);
    for (const groupedContactSheet of groupedContactSheets) {
      console.log(`✓ ${platform} grouped contact sheet: ${groupedContactSheet}`);
    }
    console.log(`✓ ${platform} coverage manifest: ${resolve(dir, 'coverage-manifest.json')}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
