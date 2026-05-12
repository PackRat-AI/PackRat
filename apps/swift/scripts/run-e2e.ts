#!/usr/bin/env bun
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Run PackRat Swift tests with credentials loaded from .env.local.
 *
 * Usage:
 *   bun e2e:swift                         # iOS UI tests, matching old behavior
 *   bun e2e:swift unit                    # PackRatTests only
 *   bun e2e:swift ios-ui                  # PackRatUITests only
 *   bun e2e:swift ios-smoke               # focused iOS UI smoke subset
 *   bun e2e:swift all                     # PackRatTests + PackRatUITests
 *   bun e2e:swift mac-build               # macOS app compile check, signing disabled
 *   bun e2e:swift mac-smoke               # focused macOS UI smoke subset
 *   bun e2e:swift mac-ui                  # full PackRatMacUITests suite
 *   bun e2e:swift ios-ui -only-testing:PackRatUITests/AuthTests/testLoginScreenAppears
 *
 * Required for UI modes:
 *   E2E_EMAIL or E2E_TEST_EMAIL
 *   E2E_PASSWORD or E2E_TEST_PASSWORD
 *
 * Optional for UI modes:
 *   E2E_API_BASE_URL
 */

const REPO_ROOT = resolve(import.meta.dir, '../../..');
const SWIFT_DIR = resolve(REPO_ROOT, 'apps/swift');
const IOS_SCHEME_PATH = resolve(
  SWIFT_DIR,
  'PackRat.xcodeproj/xcshareddata/xcschemes/PackRat-iOS.xcscheme',
);
const MAC_SCHEME_PATH = resolve(
  SWIFT_DIR,
  'PackRat.xcodeproj/xcshareddata/xcschemes/PackRat-macOS.xcscheme',
);
const TEST_RESULTS_DIR = resolve(SWIFT_DIR, 'TestResults');

const QUOTE_RE = /^["']|["']$/g;
const ENV_BLOCK_RE = /\s*<EnvironmentVariables>[\s\S]*?<\/EnvironmentVariables>/g;
const TEST_ACTION_INHERIT_RE = /(<TestAction[^>]*?)shouldUseLaunchSchemeArgsEnv\s*=\s*"YES"/;
const BOOTED_IPHONE_RE = /iPhone[^()]+\(([0-9A-F-]{36})\)\s+\(Booted\)/;
const AVAILABLE_IPHONE_RE = /^\s+(iPhone[^(]+)\s+\(([0-9A-F-]{36})\)\s+\((?:Shutdown|Booted)\)/gm;
const AMP_RE = /&/g;
const LT_RE = /</g;
const GT_RE = />/g;
const DQUOTE_RE = /"/g;
const SQUOTE_RE = /'/g;
const CREDENTIAL_KEY_RE = /(TOKEN|SECRET|PASSWORD|KEY|EMAIL|AUTH|CREDENTIAL)/i;
const WHITESPACE_RE = /\s+/;
const IPHONE_17_RE = /iPhone 17\b/;
const RESULT_BUNDLE_STAMP_RE = /[:.]/g;

export type SwiftTestMode =
  | 'unit'
  | 'ios-smoke'
  | 'ios-ui'
  | 'all'
  | 'mac-build'
  | 'mac-smoke'
  | 'mac-ui';

const SWIFT_TEST_MODES: readonly SwiftTestMode[] = [
  'unit',
  'ios-smoke',
  'ios-ui',
  'all',
  'mac-build',
  'mac-smoke',
  'mac-ui',
];
const KNOWN_SWIFT_TEST_MODES = new Set<string>(SWIFT_TEST_MODES);
const IOS_SMOKE_FILTERS = [
  '-only-testing:PackRatUITests/AuthTests/testSuccessfulLogin',
  '-only-testing:PackRatUITests/NavigationTests/testAllPrimaryTabsReachable',
  '-only-testing:PackRatUITests/PackTests/testCreatePack',
];
const MAC_SMOKE_FILTERS = [
  '-only-testing:PackRatMacUITests/MacSmokeTests',
  '-only-testing:PackRatMacUITests/MacNavigationTests/testEverySidebarDestinationIsReachable',
  '-only-testing:PackRatMacUITests/MacPackTripTests/testCreateOpenAndAddItemToPack',
];

type ParsedArgs = {
  mode: SwiftTestMode;
  passthrough: string[];
};

type GitInfo = {
  branch: string;
  head: string;
  upstream: string | null;
  ahead: number | null;
  behind: number | null;
};

type UITestEnvOptions = {
  email: string;
  password: string;
  env?: NodeJS.ProcessEnv;
};

function isSwiftTestMode(value: string): value is SwiftTestMode {
  return KNOWN_SWIFT_TEST_MODES.has(value);
}

export function parseArgs(args: string[]): ParsedArgs {
  const [first, ...rest] = args;
  if (first && isSwiftTestMode(first)) {
    return { mode: first, passthrough: rest };
  }
  return { mode: 'ios-ui', passthrough: args };
}

export function loadDotEnv(path: string, env: NodeJS.ProcessEnv = process.env): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(QUOTE_RE, '');
    if (env[key] === undefined) env[key] = value;
  }
}

export function redactSecrets(value: string, env: NodeJS.ProcessEnv = process.env): string {
  let redacted = value;
  for (const key of Object.keys(env)) {
    if (!CREDENTIAL_KEY_RE.test(key)) continue;
    const secret = env[key];
    if (!secret || secret.length < 3) continue;
    redacted = redacted.split(secret).join('<redacted>');
  }
  return redacted;
}

function execGit(args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

export function getGitInfo(): GitInfo {
  const branch = execGit(['branch', '--show-current']) || '(detached)';
  const head = execGit(['rev-parse', '--short=12', 'HEAD']) || 'unknown';
  const upstream = execGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  let ahead: number | null = null;
  let behind: number | null = null;

  if (upstream) {
    const counts = execGit(['rev-list', '--left-right', '--count', `HEAD...${upstream}`]);
    if (counts) {
      const [left, right] = counts.split(WHITESPACE_RE).map((n) => Number.parseInt(n, 10));
      ahead = Number.isFinite(left) ? left : null;
      behind = Number.isFinite(right) ? right : null;
    }
  }

  return { branch, head, upstream, ahead, behind };
}

export function pickIOSDestination(simctlOutput: string): string {
  const booted = simctlOutput.match(BOOTED_IPHONE_RE);
  if (booted) return `platform=iOS Simulator,id=${booted[1]}`;

  const phones = [...simctlOutput.matchAll(AVAILABLE_IPHONE_RE)];
  const preferred = phones.find((match) => IPHONE_17_RE.test(match[1])) ?? phones[0];
  if (preferred) return `platform=iOS Simulator,id=${preferred[2]}`;

  return 'platform=iOS Simulator,name=iPhone 17';
}

function currentIOSDestination(): string {
  try {
    return pickIOSDestination(
      execFileSync('xcrun', ['simctl', 'list', 'devices', 'available'], {
        encoding: 'utf8',
      }),
    );
  } catch {
    return 'platform=iOS Simulator,name=iPhone 17';
  }
}

function escapeXml(s: string): string {
  return s
    .replace(AMP_RE, '&amp;')
    .replace(LT_RE, '&lt;')
    .replace(GT_RE, '&gt;')
    .replace(DQUOTE_RE, '&quot;')
    .replace(SQUOTE_RE, '&apos;');
}

export function injectSchemeEnv(schemePath: string, values: Record<string, string>): void {
  let content = readFileSync(schemePath, 'utf8');

  content = content.replace(ENV_BLOCK_RE, '');
  content = content.replace(TEST_ACTION_INHERIT_RE, '$1shouldUseLaunchSchemeArgsEnv = "NO"');

  const entries = Object.entries(values).flatMap(([key, value]) => [
    '         <EnvironmentVariable',
    `            key = "${escapeXml(key)}"`,
    `            value = "${escapeXml(value)}"`,
    '            isEnabled = "YES">',
    '         </EnvironmentVariable>',
  ]);

  const block = [
    '      <EnvironmentVariables>',
    ...entries,
    '      </EnvironmentVariables>',
    '',
  ].join('\n');

  content = content.replace('   </TestAction>', `${block}   </TestAction>`);
  writeFileSync(schemePath, content);
}

function schemePathForMode(mode: SwiftTestMode): string {
  return mode === 'mac-build' || mode === 'mac-smoke' || mode === 'mac-ui'
    ? MAC_SCHEME_PATH
    : IOS_SCHEME_PATH;
}

function requireGeneratedProject(mode: SwiftTestMode): void {
  const schemePath = schemePathForMode(mode);
  if (!existsSync(schemePath)) {
    console.error(`Scheme not found at ${schemePath}`);
    console.error("Run 'bun swift' first to regenerate PackRat.xcodeproj.");
    process.exit(1);
  }
}

function requireE2ECredentials(): { email: string; password: string } {
  const email = process.env.E2E_EMAIL || process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_PASSWORD || process.env.E2E_TEST_PASSWORD;
  const missing = [
    ['E2E_EMAIL or E2E_TEST_EMAIL', email],
    ['E2E_PASSWORD or E2E_TEST_PASSWORD', password],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    console.error(`Missing required UI test environment variable(s): ${missing.join(', ')}`);
    console.error('Set them in .env.local or the process environment. Values are never printed.');
    process.exit(1);
  }

  if (!email || !password) {
    console.error('Missing required UI test credentials.');
    process.exit(1);
  }

  return { email, password };
}

function resultBundlePath(mode: SwiftTestMode): string {
  mkdirSync(TEST_RESULTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(RESULT_BUNDLE_STAMP_RE, '-');
  const path = resolve(TEST_RESULTS_DIR, `${mode}-${stamp}.xcresult`);
  if (existsSync(path)) rmSync(path, { recursive: true, force: true });
  return path;
}

function printPreflight(mode: SwiftTestMode, destination: string | null): void {
  const git = getGitInfo();
  console.log(`Swift test mode: ${mode}`);
  console.log(`Git branch: ${git.branch}`);
  console.log(`Git HEAD: ${git.head}`);
  if (git.upstream) {
    console.log(
      `Git upstream: ${git.upstream} (ahead ${git.ahead ?? '?'}, behind ${git.behind ?? '?'})`,
    );
    if ((git.behind ?? 0) > 0) {
      console.log(
        'Warning: local branch is behind upstream. Fetch/rebase before editing shared files.',
      );
    }
  } else {
    console.log('Warning: no upstream configured for this branch.');
  }
  if (destination) console.log(`Destination: ${destination}`);
}

function buildXcodeArgs(mode: SwiftTestMode, passthrough: string[]): string[] {
  if (mode === 'mac-build') {
    return [
      'build',
      '-project',
      'PackRat.xcodeproj',
      '-scheme',
      'PackRat-macOS',
      'CODE_SIGNING_ALLOWED=NO',
      ...passthrough,
    ];
  }

  if (mode === 'mac-smoke' || mode === 'mac-ui') {
    return [
      'test',
      '-project',
      'PackRat.xcodeproj',
      '-scheme',
      'PackRat-macOS',
      '-resultBundlePath',
      resultBundlePath(mode),
      ...(mode === 'mac-smoke' ? MAC_SMOKE_FILTERS : ['-only-testing:PackRatMacUITests']),
      'CODE_SIGN_IDENTITY=-',
      'CODE_SIGN_STYLE=Manual',
      'DEVELOPMENT_TEAM=',
      'PROVISIONING_PROFILE_SPECIFIER=',
      ...passthrough,
    ];
  }

  const args = [
    'test',
    '-project',
    'PackRat.xcodeproj',
    '-scheme',
    'PackRat-iOS',
    '-destination',
    currentIOSDestination(),
    '-resultBundlePath',
    resultBundlePath(mode),
  ];

  if (mode === 'unit') args.push('-only-testing:PackRatTests');
  if (mode === 'ios-smoke') args.push(...IOS_SMOKE_FILTERS);
  if (mode === 'ios-ui') args.push('-only-testing:PackRatUITests');

  return [...args, ...passthrough];
}

function shouldInjectCredentials(mode: SwiftTestMode): boolean {
  return (
    mode === 'ios-smoke' ||
    mode === 'ios-ui' ||
    mode === 'all' ||
    mode === 'mac-smoke' ||
    mode === 'mac-ui'
  );
}

export function buildUITestEnv({
  email,
  password,
  env = process.env,
}: UITestEnvOptions): Record<string, string> {
  return {
    E2E_EMAIL: email,
    E2E_PASSWORD: password,
    ...(env.E2E_API_BASE_URL ? { E2E_API_BASE_URL: env.E2E_API_BASE_URL } : {}),
    E2E_SCREENSHOT_DIR: env.E2E_SCREENSHOT_DIR || resolve(TEST_RESULTS_DIR, 'screenshots'),
  };
}

export function buildXcodeEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const allowed = [
    'DEVELOPER_DIR',
    'HOME',
    'LANG',
    'LC_ALL',
    'LC_CTYPE',
    'LOGNAME',
    'PATH',
    'SDKROOT',
    'SHELL',
    'TMPDIR',
    'USER',
    'UsePerConfigurationBuildLocations',
  ];

  return Object.fromEntries(
    allowed
      .map((key) => [key, env[key]])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

async function runXcodebuild(args: string[]): Promise<number> {
  return await new Promise((resolve) => {
    const child = spawn('xcodebuild', args, {
      cwd: SWIFT_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: buildXcodeEnv(),
    });

    child.stdout.on('data', (chunk: Buffer) =>
      process.stdout.write(redactSecrets(chunk.toString())),
    );
    child.stderr.on('data', (chunk: Buffer) =>
      process.stderr.write(redactSecrets(chunk.toString())),
    );
    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', (error) => {
      console.error(redactSecrets(String(error)));
      resolve(1);
    });
  });
}

async function main(): Promise<never> {
  loadDotEnv(resolve(REPO_ROOT, '.env.local'));
  const { mode, passthrough } = parseArgs(process.argv.slice(2));
  requireGeneratedProject(mode);

  if (shouldInjectCredentials(mode)) {
    const { email, password } = requireE2ECredentials();
    const uiEnv = buildUITestEnv({ email, password });
    mkdirSync(uiEnv.E2E_SCREENSHOT_DIR, { recursive: true });
    injectSchemeEnv(schemePathForMode(mode), uiEnv);
    const baseURLStatus = process.env.E2E_API_BASE_URL ? ', E2E_API_BASE_URL=<set>' : '';
    console.log(
      `Injected UI test environment into generated scheme: E2E_EMAIL=<set>, E2E_PASSWORD=<set>${baseURLStatus}, E2E_SCREENSHOT_DIR=${uiEnv.E2E_SCREENSHOT_DIR}`,
    );
  }

  const args = buildXcodeArgs(mode, passthrough);
  const destinationIndex = args.indexOf('-destination');
  const destination = destinationIndex === -1 ? null : args[destinationIndex + 1];
  printPreflight(mode, destination);

  const bundleIndex = args.indexOf('-resultBundlePath');
  if (bundleIndex !== -1) console.log(`Result bundle: ${args[bundleIndex + 1]}`);

  console.log(`Running: xcodebuild ${redactSecrets(args.join(' '))}`);

  process.exit(await runXcodebuild(args));
}

if (import.meta.main) {
  void main();
}

export const paths = {
  repoRoot: REPO_ROOT,
  swiftDir: SWIFT_DIR,
  iosSchemePath: IOS_SCHEME_PATH,
  macSchemePath: MAC_SCHEME_PATH,
  testResultsDir: TEST_RESULTS_DIR,
};
