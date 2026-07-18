#!/usr/bin/env bun
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { APP_CONFIG } from '@packrat/config/config';
import { nodeEnv } from '@packrat/env/node';
import { fromZod, isNumber, isObject, isString } from '@packrat/guards';
import { safeJsonParse, safeJsonStringify, sleep } from '@packrat/utils';
import {
  anyOf,
  caseInsensitive,
  charIn,
  charNotIn,
  createRegExp,
  exactly,
  global as globalFlag,
  oneOrMore,
} from 'magic-regexp';
import { z } from 'zod';
import { ensureLocalE2EAPI } from './lib/e2e-api';
import { formatSummaryLine, readSummary, type TestSummary, XcResultError } from './lib/xcresult';

type Platform = 'ios' | 'ipad' | 'macos' | 'watch';

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
  screenshotCount: number;
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
const IOS_SCHEME_PATH = resolve(
  SWIFT_DIR,
  'PackRat.xcodeproj/xcshareddata/xcschemes/PackRat-iOS.xcscheme',
);
const MACOS_SCHEME_PATH = resolve(
  SWIFT_DIR,
  'PackRat.xcodeproj/xcshareddata/xcschemes/PackRat-macOS.xcscheme',
);
const EMAIL_RE = createRegExp(
  oneOrMore(charIn('A-Z0-9._%+-')),
  '@',
  oneOrMore(charIn('A-Z0-9.-')),
  '.',
  oneOrMore(charIn('A-Z')),
  [globalFlag, caseInsensitive],
);
const SECRET_BUILD_SETTING_RE = createRegExp(
  'PACKRAT_E2E_',
  anyOf('EMAIL', 'PASSWORD', 'SESSION_TOKEN', 'USER_ID'),
  '=',
  oneOrMore(charNotIn(' \t\n\r')),
  [globalFlag],
);
const E2E_LOCAL_TOKEN_RE = createRegExp(exactly('e2e-local.'), oneOrMore(charIn('A-F0-9')), [
  globalFlag,
  caseInsensitive,
]);
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
const FEATURE_FLAGS = APP_CONFIG.featureFlags;
const API_E2E_ENV_PATH = resolve(REPO_ROOT, 'packages/api/.dev.vars.e2e');
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
  'trail-conditions',
  'weather',
  ...(FEATURE_FLAGS.enableFeed ? ['feed'] : []),
  ...(FEATURE_FLAGS.enableShoppingList ? ['shopping-list'] : []),
  ...(FEATURE_FLAGS.enableWildlifeIdentification ? ['wildlife'] : []),
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
  'guides',
  'gear-inventory',
  'ai-packs',
  'season-suggestions',
  ...(FEATURE_FLAGS.enableFeed ? ['feed'] : []),
  ...(FEATURE_FLAGS.enableWildlifeIdentification ? ['wildlife'] : []),
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
      isDataDetailScreenshot(fileName) || fileName.startsWith('8') || fileName.startsWith('9'),
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
  bun swift:screenshots --platform watch
  bun swift:screenshots --skip-tests
  bun swift:screenshots --out artifacts/screenshots

Captures guest and authenticated visual surfaces through VisualScreenshotTests and assembles:
  artifacts/screenshots/ios-contact-sheet.png
  artifacts/screenshots/ipad-contact-sheet.png
  artifacts/screenshots/macos-contact-sheet.png
  artifacts/screenshots/watch-contact-sheet.png`);
  process.exit(0);
}

function parseArgs(argv: readonly string[]): Options {
  let platforms: Platform[] = ['ios', 'ipad', 'macos', 'watch'];
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
      if (!value) throw new Error('--platform requires ios, ipad, macos, watch, both, or all');
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
  if (normalized === 'both') return ['ios', 'ipad', 'macos', 'watch'];
  if (normalized === 'all') return ['ios', 'ipad', 'macos', 'watch'];
  if (normalized === 'ios') return ['ios'];
  if (normalized === 'ipad') return ['ipad'];
  if (normalized === 'macos') return ['macos'];
  if (normalized === 'watch' || normalized === 'watchos') return ['watch'];
  throw new Error(`Unknown platform "${value}". Expected ios, ipad, macos, watch, both, or all.`);
}

function requirement(
  name: string,
  metadata: Omit<ScreenshotRequirement, 'name'>,
): ScreenshotRequirement {
  return { ...metadata, name: `${name}.png` };
}

function durationFromEnv(name: string, fallback: number): number {
  const raw = nodeScriptEnv(name) ?? Bun.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nodeScriptEnv(name: string): string | undefined {
  if (name === 'PACKRAT_VISUAL_XCODEBUILD_TIMEOUT_MS') {
    return nodeEnv.PACKRAT_VISUAL_XCODEBUILD_TIMEOUT_MS;
  }
  if (name === 'PACKRAT_XCRESULT_EXPORT_TIMEOUT_MS') {
    return nodeEnv.PACKRAT_XCRESULT_EXPORT_TIMEOUT_MS;
  }
  return undefined;
}

function redactSecrets(output: string): string {
  let redacted = output;
  for (const secret of [
    Bun.env.E2E_EMAIL,
    Bun.env.E2E_PASSWORD,
    Bun.env.E2E_TEST_EMAIL,
    Bun.env.E2E_TEST_PASSWORD,
    Bun.env.PACKRAT_E2E_EMAIL,
    Bun.env.PACKRAT_E2E_PASSWORD,
    Bun.env.PACKRAT_E2E_SESSION_TOKEN,
    Bun.env.PACKRAT_E2E_USER_ID,
  ]) {
    if (!secret) continue;
    redacted = redacted.split(secret).join('[REDACTED]');
  }
  redacted = redacted.replace(E2E_LOCAL_TOKEN_RE, '[REDACTED_E2E_TOKEN]');
  redacted = redacted.replace(EMAIL_RE, '[REDACTED_EMAIL]');
  redacted = redacted.replace(SECRET_BUILD_SETTING_RE, (match) => {
    const equalsIndex = match.indexOf('=');
    return `${match.slice(0, equalsIndex + 1)}[REDACTED]`;
  });
  return redacted;
}

function requiredScreenshots(platform: Platform): ScreenshotRequirement[] {
  if (platform === 'watch') {
    return [
      requirement('00-watch-dashboard', {
        area: 'offline-local',
        flow: 'Watch companion unsynced dashboard',
      }),
      requirement('01-watch-checklist', {
        area: 'crud',
        flow: 'Watch checklist page',
      }),
      requirement('02-watch-weather', {
        area: 'data',
        flow: 'Watch weather page',
      }),
      requirement('03-watch-trail-report', {
        area: 'crud',
        flow: 'Watch trail report draft page',
      }),
      requirement('10-watch-synced-dashboard', {
        area: 'data',
        flow: 'Watch synced dashboard',
      }),
      requirement('11-watch-synced-checklist', {
        area: 'data',
        flow: 'Watch synced checklist',
      }),
      requirement('12-watch-synced-weather', {
        area: 'data',
        flow: 'Watch synced weather',
      }),
      requirement('13-watch-synced-trail-report', {
        area: 'crud',
        flow: 'Watch synced trail report draft page',
      }),
      requirement('14-watch-synced-trail-draft-saved', {
        area: 'crud',
        flow: 'Watch trail report draft queued for iPhone sync',
      }),
    ];
  }

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
          requirement('71-data-packs-list', {
            area: 'crud',
            flow: 'Packs list with seeded data',
          }),
          requirement('72-data-pack-detail', { area: 'crud', flow: 'Pack detail with items' }),
          requirement('73-data-trips-list', {
            area: 'crud',
            flow: 'Trips list with seeded data',
          }),
          requirement('74-data-trip-detail', { area: 'crud', flow: 'Trip detail' }),
          requirement('75-data-templates-list', {
            area: 'crud',
            flow: 'Templates list with seeded data',
          }),
          requirement('76-data-template-detail', { area: 'crud', flow: 'Template detail' }),
          requirement('77-data-trail-conditions-list', {
            area: 'crud',
            flow: 'Trail conditions list with seeded data',
          }),
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
  ];

  if (FEATURE_FLAGS.enableFeed) {
    common.push(
      requirement('94-data-feed-comments-sheet', {
        area: 'crud',
        flow: 'Feed comments sheet',
      }),
    );
  }

  if (platform === 'macos' || platform === 'ios' || platform === 'ipad') {
    common.push(
      requirement('95-data-ai-packs-results-sheet', {
        area: 'ai',
        flow: 'Generated AI packs result sheet',
      }),
    );
  }

  if (platform === 'macos' || platform === 'ipad') {
    common.push(
      requirement('87a-data-trip-location-search-sheet', {
        area: 'crud',
        flow: 'Trip location search sheet',
      }),
      requirement('89a-data-custom-template-detail', {
        area: 'crud',
        flow: 'Custom template detail',
      }),
      requirement('89b-data-template-add-item-sheet', {
        area: 'crud',
        flow: 'Template item create sheet',
      }),
      requirement('89c-data-custom-template-before-edit', {
        area: 'crud',
        flow: 'Custom template detail before editing',
      }),
      requirement('89d-data-template-edit-sheet', {
        area: 'crud',
        flow: 'Template edit sheet',
      }),
      requirement('90a-data-catalog-item-before-add', {
        area: 'data',
        flow: 'Catalog item detail before adding to pack',
      }),
    );

    if (FEATURE_FLAGS.enableShoppingList) {
      common.push(
        requirement('96-data-shopping-list', {
          area: 'offline-local',
          flow: 'Shopping list with seeded data',
        }),
        requirement('97-data-shopping-add-item-sheet', {
          area: 'offline-local',
          flow: 'Shopping list item create sheet',
        }),
      );
    }
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
    );

    if (FEATURE_FLAGS.enableFeed) {
      requirements.push(
        requirement(`${prefix}-feed-compose-sheet`, { area: 'crud', flow: 'Feed compose form' }),
      );
    }
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
    `${safeJsonStringify(manifest, null, 2)}\n`,
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
      .replace(createRegExp(anyOf(exactly('"'), exactly("'")), [globalFlag]), '');
    if (Bun.env[key] === undefined) Bun.env[key] = value;
  }
}

function pickIOSDestination(platform: Extract<Platform, 'ios' | 'ipad'>): string {
  if (platform === 'ipad') {
    return pickAvailableIOSDestination({
      preferredNames: [
        'PackRat E2E iPad',
        'iPad Pro 13-inch (M5)',
        'iPad Pro 11-inch (M5)',
        'iPad Air 13-inch (M4)',
        'iPad Air 13-inch (M2)',
        'iPad Pro (12.9-inch) (6th generation)',
      ],
      fallbackName: 'iPad Pro 13-inch (M5)',
      nameIncludes: 'iPad',
      createIfMissing: {
        name: 'PackRat E2E iPad',
        preferredDeviceTypes: [
          'iPad Pro 13-inch (M5)',
          'iPad Pro 11-inch (M5)',
          'iPad Air 13-inch (M4)',
          'iPad Air 13-inch (M2)',
          'iPad Pro (12.9-inch) (6th generation)',
        ],
      },
    });
  }
  return pickAvailableIOSDestination({
    preferredNames: ['iPhone 17 Pro', 'iPhone 17', 'iPhone Air'],
    fallbackName: 'iPhone 17 Pro',
    nameIncludes: 'iPhone',
  });
}

function pickAvailableIOSDestination({
  preferredNames,
  fallbackName,
  nameIncludes,
  createIfMissing,
}: {
  preferredNames: string[];
  fallbackName: string;
  nameIncludes: string;
  createIfMissing?: { name: string; preferredDeviceTypes: string[] };
}): string {
  const result = spawnSync('xcrun', ['simctl', 'list', 'devices', 'available', '-j'], {
    encoding: 'utf8',
    timeout: 10_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  let inventorySucceeded = false;
  if (result.status === 0) {
    try {
      const parsed = safeJsonParse<{
        devices?: Record<string, Array<{ name?: string; udid?: string; isAvailable?: boolean }>>;
      }>(result.stdout, { strict: true });
      inventorySucceeded = true;
      const availableDevices = Object.values(parsed.devices ?? {}).flat();
      for (const preferredName of preferredNames) {
        const preferred = availableDevices.find(
          (device) => device.isAvailable && device.name === preferredName,
        );
        if (preferred?.udid) return `platform=iOS Simulator,id=${preferred.udid}`;
      }
      for (const devices of Object.values(parsed.devices ?? {})) {
        const device = devices.find(
          (candidate) => candidate.isAvailable && candidate.name?.includes(nameIncludes),
        );
        if (device?.udid) return `platform=iOS Simulator,id=${device.udid}`;
      }
    } catch {}
  }
  if (createIfMissing && inventorySucceeded) {
    const createdDeviceId = createIOSSimulator(createIfMissing);
    if (createdDeviceId) return `platform=iOS Simulator,id=${createdDeviceId}`;
  }
  return `platform=iOS Simulator,name=${fallbackName}`;
}

function createIOSSimulator({
  name,
  preferredDeviceTypes,
}: {
  name: string;
  preferredDeviceTypes: string[];
}): string | null {
  const deviceTypeId = pickDeviceTypeId(preferredDeviceTypes);
  const runtimeId = pickLatestIOSRuntimeId();
  if (!deviceTypeId || !runtimeId) return null;
  const result = spawnSync('xcrun', ['simctl', 'create', name, deviceTypeId, runtimeId], {
    encoding: 'utf8',
    timeout: 30_000,
  });
  if (result.status !== 0) return null;
  const deviceId = result.stdout.trim();
  return deviceId || null;
}

function pickDeviceTypeId(preferredNames: string[]): string | null {
  const result = spawnSync('xcrun', ['simctl', 'list', 'devicetypes', '-j'], {
    encoding: 'utf8',
    timeout: 10_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.status !== 0) return null;
  try {
    const parsed = safeJsonParse<{
      devicetypes?: Array<{ name?: string; identifier?: string }>;
    }>(result.stdout, { strict: true });
    for (const preferredName of preferredNames) {
      const deviceType = parsed.devicetypes?.find((candidate) => candidate.name === preferredName);
      if (deviceType?.identifier) return deviceType.identifier;
    }
  } catch {}
  return null;
}

function pickLatestIOSRuntimeId(): string | null {
  const result = spawnSync('xcrun', ['simctl', 'list', 'runtimes', '-j'], {
    encoding: 'utf8',
    timeout: 10_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.status !== 0) return null;
  try {
    const parsed = safeJsonParse<{
      runtimes?: Array<{
        identifier?: string;
        isAvailable?: boolean;
        platform?: string;
        version?: string;
      }>;
    }>(result.stdout, { strict: true });
    const runtimes = (parsed.runtimes ?? [])
      .filter(
        (runtime) =>
          runtime.isAvailable &&
          runtime.identifier &&
          (runtime.platform === 'iOS' || runtime.identifier.includes('iOS')),
      )
      .sort((a, b) => compareVersions(b.version ?? '', a.version ?? ''));
    return runtimes[0]?.identifier ?? null;
  } catch {}
  return null;
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  const count = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < count; index += 1) {
    const diff = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
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

async function runXcodeVisualTest(
  platform: Platform,
  screenshotDir: string,
): Promise<VisualTestResult> {
  if (platform === 'watch') return runWatchVisualCapture(screenshotDir);

  const resultBundle = allocateResultBundle(platform);
  const writableScreenshotDir = allocateWritableScreenshotDir(platform);
  const packratEnv = Bun.env.PACKRAT_ENV ?? nodeEnv.PACKRAT_ENV ?? 'local';
  const authMode = visualAuthMode(packratEnv);
  const apiBaseURL = Bun.env.E2E_API_BASE_URL ?? '';
  const credentials = e2eBuildSettings(packratEnv);
  const visualBuildSettings = [
    ...(apiBaseURL ? [`E2E_API_BASE_URL=${apiBaseURL}`] : []),
    `PACKRAT_ENV=${packratEnv}`,
    `PACKRAT_VISUAL_AUTH_MODE=${authMode}`,
    `PACKRAT_VISUAL_PLATFORM=${platform}`,
  ];
  injectVisualSchemeEnvironment(platform, {
    E2E_API_BASE_URL: apiBaseURL,
    PACKRAT_ENV: packratEnv,
    PACKRAT_SCREENSHOT_DIR: writableScreenshotDir,
    PACKRAT_VISUAL_AUTH_MODE: authMode,
    PACKRAT_VISUAL_PLATFORM: platform,
    ...buildSettingsToEnv(credentials),
  });
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
          ...visualBuildSettings,
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
          ...visualBuildSettings,
          ...credentials,
        ];

  console.log(`→ Capturing ${platform} screenshots`);
  console.log(`→ Screenshot dir: ${screenshotDir}`);
  console.log(`→ XCTest write dir: ${writableScreenshotDir}`);
  console.log(`→ Result bundle: ${resultBundle}`);

  await assertDeployedVisualAuthReady({ packratEnv, apiBaseURL, authMode });

  if (platform === 'macos') {
    assertAutomationModeAvailable();
    clearMacNotificationBanners();
  }

  return new Promise((resolvePromise, reject) => {
    let timedOut = false;
    let finalized = false;
    const child = spawn('xcodebuild', args, {
      cwd: SWIFT_DIR,
      env: {
        ...Bun.env,
        E2E_API_BASE_URL: apiBaseURL,
        PACKRAT_ENV: packratEnv,
        PACKRAT_VISUAL_AUTH_MODE: authMode,
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

function injectVisualSchemeEnvironment(platform: Platform, env: Record<string, string>): void {
  const schemePath = platform === 'macos' ? MACOS_SCHEME_PATH : IOS_SCHEME_PATH;
  if (!existsSync(schemePath)) return;

  let content = readFileSync(schemePath, 'utf8');
  content = removeEnvironmentVariablesBlock(content);
  content = content.replace(
    'shouldUseLaunchSchemeArgsEnv = "YES"',
    'shouldUseLaunchSchemeArgsEnv = "NO"',
  );

  const variables = Object.entries(env)
    .filter(([, value]) => value.length > 0)
    .map(([key, value]) => environmentVariableXml(key, value));
  if (variables.length === 0) {
    writeFileSync(schemePath, content);
    return;
  }

  const block = [
    '      <EnvironmentVariables>',
    ...variables,
    '      </EnvironmentVariables>',
    '',
  ].join('\n');
  writeFileSync(schemePath, content.replace('   </TestAction>', `${block}   </TestAction>`));
}

function buildSettingsToEnv(settings: string[]): Record<string, string> {
  const env: Record<string, string> = {};
  for (const setting of settings) {
    const equals = setting.indexOf('=');
    if (equals <= 0) continue;
    env[setting.slice(0, equals)] = setting.slice(equals + 1);
  }
  return env;
}

function environmentVariableXml(key: string, value: string): string {
  return [
    '         <EnvironmentVariable',
    `            key = "${escapeXml(key)}"`,
    `            value = "${escapeXml(value)}"`,
    '            isEnabled = "YES">',
    '         </EnvironmentVariable>',
  ].join('\n');
}

function removeEnvironmentVariablesBlock(content: string): string {
  let output = content;
  while (true) {
    const start = output.indexOf('<EnvironmentVariables>');
    if (start === -1) return output;
    const end = output.indexOf('</EnvironmentVariables>', start);
    if (end === -1) return output;
    const removalStart = output.lastIndexOf('\n', start);
    const removalEnd = end + '</EnvironmentVariables>'.length;
    output = `${output.slice(0, removalStart === -1 ? start : removalStart)}${output.slice(removalEnd)}`;
  }
}

function escapeXml(s: string): string {
  return Array.from(s, (char) => {
    if (char === '&') return '&amp;';
    if (char === '<') return '&lt;';
    if (char === '>') return '&gt;';
    if (char === '"') return '&quot;';
    if (char === "'") return '&apos;';
    return char;
  }).join('');
}

async function runWatchVisualCapture(screenshotDir: string): Promise<VisualTestResult> {
  const destination = pickAvailableWatchDestination();
  const deviceId = destination.deviceId;
  const buildArgs = [
    '-project',
    'PackRat.xcodeproj',
    '-scheme',
    'PackRat-Watch',
    '-destination',
    `platform=watchOS Simulator,id=${deviceId}`,
    '-configuration',
    'Debug',
    'build',
  ];

  console.log('→ Capturing watch screenshots');
  console.log(`→ Watch simulator: ${destination.name} (${deviceId})`);
  console.log(`→ Screenshot dir: ${screenshotDir}`);
  runChecked({
    command: 'xcodebuild',
    args: buildArgs,
    cwd: SWIFT_DIR,
    timeout: XCODEBUILD_TIMEOUT_MS,
  });

  const appPath = resolveWatchAppPath(deviceId);
  runChecked({
    command: 'xcrun',
    args: ['simctl', 'boot', deviceId],
    cwd: SWIFT_DIR,
    timeout: 30_000,
    allowFailure: true,
  });
  runChecked({
    command: 'xcrun',
    args: ['simctl', 'install', deviceId, appPath],
    cwd: SWIFT_DIR,
    timeout: 60_000,
  });
  mkdirSync(screenshotDir, { recursive: true });
  const syncedSnapshot = watchSyncedSnapshotBase64();
  for (const route of [
    { name: '00-watch-dashboard.png', value: 'dashboard', snapshot: 'reset' },
    { name: '01-watch-checklist.png', value: 'checklist', snapshot: 'reset' },
    { name: '02-watch-weather.png', value: 'weather', snapshot: 'reset' },
    { name: '03-watch-trail-report.png', value: 'trail-report', snapshot: 'reset' },
    { name: '10-watch-synced-dashboard.png', value: 'dashboard', snapshot: 'synced' },
    { name: '11-watch-synced-checklist.png', value: 'checklist', snapshot: 'synced' },
    { name: '12-watch-synced-weather.png', value: 'weather', snapshot: 'synced' },
    { name: '13-watch-synced-trail-report.png', value: 'trail-report', snapshot: 'synced' },
    {
      name: '14-watch-synced-trail-draft-saved.png',
      value: 'trail-report-draft',
      snapshot: 'synced',
      draftSaved: true,
    },
  ] as const) {
    const env = {
      SIMCTL_CHILD_PACKRAT_WATCH_DISABLE_CONNECTIVITY: '1',
      ...(route.value ? { SIMCTL_CHILD_PACKRAT_WATCH_SCREENSHOT_ROUTE: route.value } : {}),
      ...(route.snapshot === 'reset'
        ? { SIMCTL_CHILD_PACKRAT_WATCH_RESET_SNAPSHOT: '1' }
        : { SIMCTL_CHILD_PACKRAT_WATCH_SNAPSHOT_BASE64: syncedSnapshot }),
      ...('draftSaved' in route && route.draftSaved
        ? { SIMCTL_CHILD_PACKRAT_WATCH_DRAFT_SAVED: '1' }
        : {}),
    };
    await launchWatchRouteWithRetry({ deviceId, appPath, env });

    await sleep(4_000);
    const tmpScreenshot = resolve('/tmp', `packrat-watch-${Date.now()}-${route.name}`);
    runChecked({
      command: 'xcrun',
      args: ['simctl', 'io', deviceId, 'screenshot', tmpScreenshot],
      cwd: SWIFT_DIR,
      timeout: 30_000,
    });
    cpSync(tmpScreenshot, resolve(screenshotDir, route.name));
    rmSync(tmpScreenshot, { force: true });
  }
  return { resultBundle: '', summary: null };
}

function watchSyncedSnapshotBase64(): string {
  return Buffer.from(
    safeJsonStringify({
      updatedAt: new Date('2026-05-29T16:00:00.000Z').toISOString(),
      pack: {
        name: 'Alpine Weekend',
        baseWeightText: '10.4 lb',
        packedItemCount: 3,
        totalItemCount: 4,
        checklist: [
          {
            id: 'visual-watch-shelter',
            title: 'Copper Spur Tent',
            symbolName: 'tent',
            isPacked: true,
          },
          {
            id: 'visual-watch-filter',
            title: 'Water Filter',
            symbolName: 'drop',
            isPacked: true,
          },
          {
            id: 'visual-watch-jacket',
            title: 'Rain Shell',
            symbolName: 'jacket',
            isPacked: false,
          },
          {
            id: 'visual-watch-kit',
            title: 'First Aid Kit',
            symbolName: 'cross.case',
            isPacked: true,
          },
        ],
      },
      trip: {
        name: 'Indian Peaks Overnight',
        locationName: 'Brainard Lake',
        dateText: 'Jun 12-13',
      },
      weather: {
        locationName: 'Brainard Lake',
        temperatureText: '64°',
        conditionText: 'Partly Cloudy',
        symbolName: 'cloud.sun',
      },
      trail: {
        title: 'Pawnee Pass',
        conditionText: 'Muddy',
        hazardCount: 2,
      },
    }),
  ).toString('base64');
}

function pickAvailableWatchDestination(): { deviceId: string; name: string } {
  const result = spawnSync('xcrun', ['simctl', 'list', 'devices', 'available', '-j'], {
    encoding: 'utf8',
    timeout: 10_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`Unable to list watch simulators: ${result.stderr || result.stdout}`);
  }

  const parsed = safeJsonParse<{
    devices?: Record<string, Array<{ name?: string; udid?: string; isAvailable?: boolean }>>;
  }>(result.stdout, { strict: true });
  for (const devices of Object.values(parsed.devices ?? {})) {
    const watch = devices.find(
      (device) => device.isAvailable && device.udid && device.name?.includes('Apple Watch'),
    );
    if (watch?.udid && watch.name) return { deviceId: watch.udid, name: watch.name };
  }

  throw new Error('No available Apple Watch simulator found. Install a watchOS runtime first.');
}

function resolveWatchAppPath(deviceId: string): string {
  const result = spawnSync(
    'xcodebuild',
    [
      '-project',
      'PackRat.xcodeproj',
      '-scheme',
      'PackRat-Watch',
      '-destination',
      `platform=watchOS Simulator,id=${deviceId}`,
      '-configuration',
      'Debug',
      '-showBuildSettings',
      '-json',
    ],
    {
      cwd: SWIFT_DIR,
      encoding: 'utf8',
      timeout: 30_000,
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  if (result.status !== 0) {
    throw new Error(`Unable to resolve Watch app path: ${result.stderr || result.stdout}`);
  }

  const settings = safeJsonParse<
    Array<{
      buildSettings?: { BUILT_PRODUCTS_DIR?: string; WRAPPER_NAME?: string };
    }>
  >(result.stdout, { strict: true });
  const buildSettings = settings.find(
    (entry) => entry.buildSettings?.BUILT_PRODUCTS_DIR,
  )?.buildSettings;
  if (!buildSettings?.BUILT_PRODUCTS_DIR || !buildSettings.WRAPPER_NAME) {
    throw new Error('Watch build settings did not include BUILT_PRODUCTS_DIR/WRAPPER_NAME.');
  }
  return resolve(buildSettings.BUILT_PRODUCTS_DIR, buildSettings.WRAPPER_NAME);
}

function runChecked(options: {
  command: string;
  args: string[];
  cwd: string;
  timeout: number;
  allowFailure?: boolean;
  env?: NodeJS.ProcessEnv;
}): void {
  const result = spawnSync(options.command, options.args, {
    cwd: options.cwd,
    env: { ...Bun.env, ...options.env },
    encoding: 'utf8',
    timeout: options.timeout,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status === 0 || options.allowFailure) return;
  throw new Error(
    `${options.command} ${options.args.join(' ')} failed: ${result.stderr || result.stdout}`,
  );
}

async function launchWatchRouteWithRetry(options: {
  deviceId: string;
  appPath: string;
  env: NodeJS.ProcessEnv;
}): Promise<void> {
  const { deviceId, appPath, env } = options;
  let lastOutput = '';
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    if (attempt === 3) {
      runChecked({
        command: 'xcrun',
        args: ['simctl', 'install', deviceId, appPath],
        cwd: SWIFT_DIR,
        timeout: 60_000,
        allowFailure: true,
      });
    }
    const result = spawnSync(
      'xcrun',
      [
        'simctl',
        'launch',
        '--terminate-running-process',
        deviceId,
        'com.andrewbierman.packrat.watchkitapp',
      ],
      {
        cwd: SWIFT_DIR,
        env: { ...Bun.env, ...env },
        encoding: 'utf8',
        timeout: 30_000,
        maxBuffer: 20 * 1024 * 1024,
      },
    );
    if (result.status === 0) return;
    lastOutput = result.stderr || result.stdout;
    await sleep(1_500);
  }
  throw new Error(`Unable to launch PackRat Watch for screenshot capture: ${lastOutput}`);
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

  const manifest = parseAttachmentManifest(
    safeJsonParse(readFileSync(manifestPath, 'utf8'), { strict: true }),
  );
  if (!manifest) {
    console.warn(`Warning: ${manifestPath} had an invalid attachment manifest shape.`);
    return;
  }
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
  const stable = stripXctAttachmentSuffix(suggestedName);
  return startsWithDigit(stable) ? stable : null;
}

const AttachmentManifestAttachmentSchema = z
  .object({
    exportedFileName: z.string(),
    suggestedHumanReadableName: z.string().optional(),
  })
  .passthrough();
const AttachmentManifestEntrySchema = z
  .object({
    attachments: z.array(AttachmentManifestAttachmentSchema).optional(),
  })
  .passthrough();
const parseAttachmentManifest = fromZod(z.array(AttachmentManifestEntrySchema));

function visualAuthMode(packratEnv: string): 'seeded' | 'real' {
  const explicit = Bun.env.PACKRAT_VISUAL_AUTH_MODE;
  if (explicit === 'seeded' || explicit === 'real') return explicit;
  return packratEnv === 'local' || packratEnv === 'dev-local' ? 'seeded' : 'real';
}

function e2eBuildSettings(packratEnv: string): string[] {
  const apiE2EEnv = readSimpleEnvFile(API_E2E_ENV_PATH);
  const email = Bun.env.E2E_TEST_EMAIL ?? Bun.env.E2E_EMAIL ?? apiE2EEnv.E2E_TEST_EMAIL;
  const password = Bun.env.E2E_TEST_PASSWORD ?? Bun.env.E2E_PASSWORD ?? apiE2EEnv.E2E_TEST_PASSWORD;
  if (!email || !password) {
    console.warn(
      'Warning: E2E_EMAIL/E2E_PASSWORD are not set; authenticated screenshot test will be skipped.',
    );
    return [];
  }

  const userId = Bun.env.E2E_TEST_USER_ID ?? apiE2EEnv.E2E_TEST_USER_ID;
  const shouldSynthesizeLocalToken = packratEnv === 'local' || packratEnv === 'dev-local';
  const sessionToken =
    Bun.env.PACKRAT_E2E_SESSION_TOKEN ??
    (shouldSynthesizeLocalToken && userId
      ? localE2ESessionToken({
          secret:
            Bun.env.BETTER_AUTH_SECRET ??
            apiE2EEnv.BETTER_AUTH_SECRET ??
            'e2e-better-auth-secret-at-least-32-chars',
          email,
          userId,
        })
      : undefined);

  return [
    `PACKRAT_E2E_EMAIL=${email}`,
    `PACKRAT_E2E_PASSWORD=${password}`,
    `PACKRAT_E2E_ALLOW_LOGIN_SEED=${shouldSynthesizeLocalToken ? '1' : '0'}`,
    ...(userId ? [`PACKRAT_E2E_USER_ID=${userId}`] : []),
    ...(sessionToken ? [`PACKRAT_E2E_SESSION_TOKEN=${sessionToken}`] : []),
  ];
}

async function assertDeployedVisualAuthReady(input: {
  packratEnv: string;
  apiBaseURL: string;
  authMode: 'seeded' | 'real';
}): Promise<void> {
  const { packratEnv, apiBaseURL, authMode } = input;
  if (authMode !== 'real') return;

  const baseURL =
    apiBaseURL ||
    (packratEnv === 'dev'
      ? 'https://packrat-api-dev.orange-frost-d665.workers.dev'
      : packratEnv === 'production'
        ? 'https://packrat-api.orange-frost-d665.workers.dev'
        : '');
  if (!baseURL) return;

  const email = Bun.env.E2E_TEST_EMAIL ?? Bun.env.E2E_EMAIL ?? apiE2EEnv.E2E_TEST_EMAIL;
  const password = Bun.env.E2E_TEST_PASSWORD ?? Bun.env.E2E_PASSWORD ?? apiE2EEnv.E2E_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error(
      `PACKRAT_VISUAL_AUTH_MODE=real for PACKRAT_ENV=${packratEnv}, but E2E credentials are missing.`,
    );
  }

  const response = await fetch(`${baseURL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: safeJsonStringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(
      [
        `Swift visual real-auth preflight failed for PACKRAT_ENV=${packratEnv}: ${response.status}.`,
        packratEnv === 'dev'
          ? 'Seed the dev E2E user before capturing deployed-dev screenshots.'
          : 'Use a valid production QA account before capturing production/TestFlight screenshots.',
        'The visual runner no longer falls back to seeded auth for deployed APIs.',
      ].join(' '),
    );
  }
  console.log(`✓ Verified deployed ${packratEnv} E2E auth before visual capture`);
}

function localE2ESessionToken(input: { secret: string; email: string; userId: string }): string {
  const material = `${input.secret}:${input.email.toLowerCase()}:${input.userId}`;
  return `e2e-local.${createHash('sha256').update(material).digest('hex')}`;
}

function readSimpleEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const vars: Record<string, string> = {};
  for (const rawLine of readFileSync(path, 'utf8').replaceAll('\r\n', '\n').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const index = line.indexOf('=');
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
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
    case 'watch':
      return 'watchOS';
  }
}

function listScreenshots(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.toLowerCase().endsWith('.png'))
    .filter(startsWithDigit)
    .sort((a, b) => a.localeCompare(b))
    .map((file) => resolve(dir, file));
}

function humanize(filePath: string): string {
  return stripScreenshotPrefix(basename(filePath, '.png'))
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function escapeHtml(value: string): string {
  return Array.from(value, (char) => {
    if (char === '&') return '&amp;';
    if (char === '<') return '&lt;';
    if (char === '>') return '&gt;';
    if (char === '"') return '&quot;';
    if (char === "'") return '&#39;';
    return char;
  }).join('');
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
  const cardWidth = platform === 'watch' ? 220 : isMac ? 520 : 300;
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
  if (platform === 'macos') clearMacNotificationBanners();
  rmSync(outputPath, { force: true });

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
    const chrome = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
    if (chrome) {
      await renderWithSystemChrome({ chrome, htmlPath, images, outputPath, platform });
      return;
    }

    throw new Error(`No contact sheet renderer found. Playwright failed: ${formatError(err)}`);
  }
}

async function renderWithSystemChrome({
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
}): Promise<void> {
  const width = platform === 'ios' ? 1600 : 1800;
  const height = estimateContactSheetHeight({ images, platform, width });
  const userDataDir = mkdtempSync(resolve(tmpdir(), 'packrat-contact-sheet-chrome-'));
  const child = spawn(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--disable-background-networking',
      '--disable-breakpad',
      '--disable-crash-reporter',
      '--disable-extensions',
      '--disable-notifications',
      '--deny-permission-prompts',
      '--hide-scrollbars',
      '--no-default-browser-check',
      '--no-first-run',
      `--user-data-dir=${userDataDir}`,
      `--window-size=${width},${height}`,
      `--screenshot=${outputPath}`,
      pathToFileURL(htmlPath).href,
    ],
    { detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let stdout = '';
  let stderr = '';
  child.stdout?.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr?.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const exitPromise = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolveExit, rejectExit) => {
      child.once('error', rejectExit);
      child.once('exit', (code, signal) => resolveExit({ code, signal }));
    },
  );

  try {
    const startedAt = Date.now();
    while (Date.now() - startedAt < CONTACT_SHEET_RENDER_TIMEOUT_MS) {
      if (fileIsNonEmpty(outputPath)) {
        const exitResult = await Promise.race([exitPromise, sleep(1_000).then(() => null)]);
        if (exitResult?.code === 0) return;
        await stopProcessGroup({ pid: child.pid, exitPromise, signal: 'SIGKILL' });
        return;
      }

      const exitResult = await Promise.race([exitPromise, sleep(250).then(() => null)]);
      if (exitResult) {
        if (exitResult.code === 0 && fileIsNonEmpty(outputPath)) return;
        throw new Error(
          `Chrome screenshot failed: ${stderr || stdout || `exit ${exitResult.code ?? exitResult.signal}`}`,
        );
      }
    }

    await stopProcessGroup({ pid: child.pid, exitPromise, signal: 'SIGKILL' });
    throw new Error(`Chrome screenshot timed out after ${CONTACT_SHEET_RENDER_TIMEOUT_MS}ms`);
  } finally {
    rmSync(userDataDir, { recursive: true, force: true });
  }
}

function fileIsNonEmpty(filePath: string): boolean {
  try {
    return statSync(filePath).size > 0;
  } catch {
    return false;
  }
}

async function stopProcessGroup({
  pid,
  exitPromise,
  signal = 'SIGTERM',
}: {
  pid: number | undefined;
  exitPromise: Promise<unknown>;
  signal?: NodeJS.Signals;
}): Promise<void> {
  if (!pid) return;

  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      return;
    }
  }

  await Promise.race([
    exitPromise.catch(() => undefined),
    sleep(signal === 'SIGKILL' ? 500 : 1_000),
  ]);
}

function clearMacNotificationBanners(): void {
  if (process.platform !== 'darwin') return;
  spawnSync(
    'osascript',
    [
      '-e',
      `tell application "System Events"
  tell process "NotificationCenter"
    repeat with notificationWindow in windows
      repeat with candidate in entire contents of notificationWindow
        try
          if subrole of candidate is "AXNotificationCenterAlert" then
            repeat with candidateAction in actions of candidate
              try
                if name of candidateAction is "Close" then perform candidateAction
              end try
            end repeat
          end if
        end try
      end repeat
    end repeat
  end tell
end tell`,
    ],
    { encoding: 'utf8', timeout: 5_000 },
  );
  spawnSync('killall', ['NotificationCenter'], { encoding: 'utf8', timeout: 5_000 });
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
  const cardWidth = platform === 'watch' ? 220 : platform === 'macos' ? 520 : 300;
  const columns = Math.max(
    1,
    Math.floor((width - horizontalPadding + gridGap) / (cardWidth + gridGap)),
  );
  const renderedCardWidth = Math.floor(
    (width - horizontalPadding - gridGap * (columns - 1)) / columns,
  );
  const cardHeights = images.map((image) => {
    const size = readImageSize(image);
    if (!size) return platform === 'watch' ? 280 : platform === 'ios' ? 720 : 420;
    return Math.ceil((size.height / size.width) * renderedCardWidth) + 64;
  });
  const rows: number[] = [];
  for (let index = 0; index < cardHeights.length; index += columns) {
    rows.push(Math.max(...cardHeights.slice(index, index + columns)));
  }
  return Math.max(1200, 160 + rows.reduce((sum, row) => sum + row, 0) + gridGap * rows.length);
}

function readImageSize(image: string): { width: number; height: number } | null {
  const result = spawnSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', image], {
    encoding: 'utf8',
    timeout: IMAGE_SIZE_TIMEOUT_MS,
  });
  if (result.status !== 0) return null;
  const width = readSipsDimension(result.stdout, 'pixelWidth');
  const height = readSipsDimension(result.stdout, 'pixelHeight');
  if (!width || !height) return null;
  return { width: Number(width), height: Number(height) };
}

function startsWithDigit(value: string): boolean {
  const first = value.charCodeAt(0);
  return first >= 48 && first <= 57;
}

function stripScreenshotPrefix(value: string): string {
  let index = 0;
  while (index < value.length && isDigit(value.charCodeAt(index))) index += 1;
  if (index < value.length && isAsciiLetter(value.charCodeAt(index))) index += 1;
  return value.charAt(index) === '-' ? value.slice(index + 1) : value;
}

function stripXctAttachmentSuffix(value: string): string {
  if (!value.toLowerCase().endsWith('.png')) return value;
  const withoutExtension = value.slice(0, -4);
  const secondUnderscore = withoutExtension.lastIndexOf('_');
  if (secondUnderscore === -1) return value;
  const firstUnderscore = withoutExtension.lastIndexOf('_', secondUnderscore - 1);
  if (firstUnderscore === -1) return value;
  const ordinal = withoutExtension.slice(firstUnderscore + 1, secondUnderscore);
  const identifier = withoutExtension.slice(secondUnderscore + 1);
  if (!ordinal || !Array.from(ordinal).every((char) => isDigit(char.charCodeAt(0)))) return value;
  if (!identifier || !Array.from(identifier).every(isHexOrDash)) return value;
  return `${withoutExtension.slice(0, firstUnderscore)}.png`;
}

function isDataDetailScreenshot(fileName: string): boolean {
  return (
    fileName.length > 8 &&
    fileName.charAt(0) === '7' &&
    fileName.charCodeAt(1) >= 49 &&
    fileName.charCodeAt(1) <= 57 &&
    fileName.startsWith('-data-', 2)
  );
}

function readSipsDimension(stdout: string, key: 'pixelWidth' | 'pixelHeight'): string | undefined {
  const prefix = `${key}:`;
  const line = stdout
    .split('\n')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(prefix));
  return line?.slice(prefix.length).trim();
}

function isDigit(code: number): boolean {
  return code >= 48 && code <= 57;
}

function isAsciiLetter(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isHexOrDash(char: string): boolean {
  const code = char.charCodeAt(0);
  return char === '-' || isDigit(code) || (code >= 65 && code <= 70) || (code >= 97 && code <= 102);
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function main() {
  loadDotEnv();
  const options = parseArgs(process.argv.slice(2));
  mkdirSync(options.outDir, { recursive: true });
  const runSummaryPath = resolve(options.outDir, 'run-summary.json');
  const runSummaryByPlatform = readExistingRunSummary(runSummaryPath);
  addExistingArtifactSummaries(options.outDir, runSummaryByPlatform);
  const shouldEnsureAPI =
    !options.skipTests && options.platforms.some((platform) => platform !== 'watch');
  const apiHandle = shouldEnsureAPI
    ? await ensureLocalE2EAPI({
        packratEnv: Bun.env.PACKRAT_ENV ?? nodeEnv.PACKRAT_ENV ?? 'local',
        env: Bun.env as NodeJS.ProcessEnv,
      })
    : null;

  try {
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
      const screenshotCount = countCapturedScreenshots(dir);
      const existingSummary = runSummaryByPlatform.get(platform);
      runSummaryByPlatform.set(platform, {
        platform,
        screenshotDir: dir,
        screenshotCount,
        coverageManifest,
        contactSheet,
        groupedContactSheets,
        ...(testResult
          ? {
              resultBundle: testResult.resultBundle,
              ...(testResult.summary ? { testSummary: testResult.summary } : {}),
            }
          : {
              ...(existingSummary?.resultBundle
                ? { resultBundle: existingSummary.resultBundle }
                : {}),
              ...(existingSummary?.testSummary ? { testSummary: existingSummary.testSummary } : {}),
            }),
      });
      console.log(`✓ ${platform} contact sheet: ${contactSheet}`);
      for (const groupedContactSheet of groupedContactSheets) {
        console.log(`✓ ${platform} grouped contact sheet: ${groupedContactSheet}`);
      }
      console.log(`✓ ${platform} coverage manifest: ${coverageManifest}`);
    }
  } finally {
    await apiHandle?.stop();
  }

  writeFileSync(
    runSummaryPath,
    `${safeJsonStringify(
      {
        generatedAt: new Date().toISOString(),
        skipTests: options.skipTests,
        platforms: [...runSummaryByPlatform.values()],
      },
      null,
      2,
    )}\n`,
  );
  console.log(`✓ screenshot run summary: ${runSummaryPath}`);
}

function readExistingRunSummary(path: string): Map<Platform, PlatformRunSummary> {
  const summaries = new Map<Platform, PlatformRunSummary>();
  if (!existsSync(path)) return summaries;
  try {
    const parsed = safeJsonParse<{ platforms?: unknown[] }>(readFileSync(path, 'utf8'), {
      strict: true,
    });
    for (const candidate of parsed.platforms ?? []) {
      const summary = parsePlatformRunSummary(candidate);
      if (summary) summaries.set(summary.platform, summary);
    }
  } catch {}
  return summaries;
}

function addExistingArtifactSummaries(
  outDir: string,
  summaries: Map<Platform, PlatformRunSummary>,
): void {
  for (const platform of ['ios', 'ipad', 'macos', 'watch'] satisfies Platform[]) {
    if (summaries.has(platform)) continue;
    const screenshotDir = screenshotDirFor(outDir, platform);
    const coverageManifest = resolve(screenshotDir, 'coverage-manifest.json');
    const contactSheet = resolve(outDir, `${platform}-contact-sheet.png`);
    if (!existsSync(coverageManifest) || !existsSync(contactSheet)) continue;
    const groupedContactSheets = CONTACT_SHEET_GROUPS.map((group) =>
      resolve(outDir, `${platform}-contact-sheet-${group.suffix}.png`),
    ).filter((path) => existsSync(path));
    summaries.set(platform, {
      platform,
      screenshotDir,
      screenshotCount: countCapturedScreenshots(screenshotDir),
      coverageManifest,
      contactSheet,
      groupedContactSheets,
    });
  }
}

function parsePlatformRunSummary(value: unknown): PlatformRunSummary | null {
  if (!isObject(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (!isPlatform(candidate.platform)) return null;
  if (
    !isString(candidate.screenshotDir) ||
    !isString(candidate.coverageManifest) ||
    !isString(candidate.contactSheet) ||
    !Array.isArray(candidate.groupedContactSheets) ||
    !candidate.groupedContactSheets.every((entry) => isString(entry))
  ) {
    return null;
  }

  return {
    platform: candidate.platform,
    screenshotDir: candidate.screenshotDir,
    screenshotCount:
      isNumber(candidate.screenshotCount) && Number.isFinite(candidate.screenshotCount)
        ? candidate.screenshotCount
        : countCapturedScreenshots(candidate.screenshotDir),
    coverageManifest: candidate.coverageManifest,
    contactSheet: candidate.contactSheet,
    groupedContactSheets: candidate.groupedContactSheets,
    ...(isString(candidate.resultBundle) ? { resultBundle: candidate.resultBundle } : {}),
    ...(candidate.testSummary ? { testSummary: candidate.testSummary as TestSummary } : {}),
  };
}

function isPlatform(value: unknown): value is Platform {
  return value === 'ios' || value === 'ipad' || value === 'macos' || value === 'watch';
}

function countCapturedScreenshots(screenshotDir: string): number {
  if (!existsSync(screenshotDir)) return 0;
  return readdirSync(screenshotDir).filter((fileName) => fileName.endsWith('.png')).length;
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
