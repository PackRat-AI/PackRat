#!/usr/bin/env bun
import { spawnSync } from 'node:child_process';
/**
 * Run PackRat Swift macOS tests (unit + XCUITest where possible).
 *
 * Usage:  bun e2e:swift:macos                     (run macOS-Full plan — all macOS tests)
 *         bun e2e:swift:macos --plan smoke        (run macOS-Smoke plan)
 *         bun e2e:swift:macos -only-testing:<id>  (narrow to a specific test)
 *
 * macOS XCUITest needs Accessibility permission granted to Xcode (or the
 * generated test runner). One-time setup: System Settings → Privacy & Security
 * → Accessibility → enable Xcode. Without that grant the UI tests can build
 * but fail at app-launch with a misleading 'XCTRunner failed to launch' error.
 *
 * Required env vars (in .env.local):
 *   E2E_EMAIL
 *   E2E_PASSWORD
 *
 * Differences from run-e2e.ts (iOS):
 *   - No simulator boot — runs against the host Mac.
 *   - Scheme is PackRat-macOS, destination is platform=macOS.
 *   - Different test-plan name space (macOS-Smoke / macOS-Full instead of iOS-*).
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ArgsError } from './lib/args';
import { formatSummaryLine, readSummary, XcResultError } from './lib/xcresult';

const REPO_ROOT = resolve(import.meta.dir, '../../..');
const SWIFT_DIR = resolve(REPO_ROOT, 'apps/swift');
const SCHEME_PATH = resolve(
  SWIFT_DIR,
  'PackRat.xcodeproj/xcshareddata/xcschemes/PackRat-macOS.xcscheme',
);
const RESULTS_DIR = resolve(SWIFT_DIR, 'TestResults');

const QUOTE_RE = /^["']|["']$/g;
const ENV_BLOCK_RE = /\s*<EnvironmentVariables>[\s\S]*?<\/EnvironmentVariables>/g;
const TEST_ACTION_INHERIT_RE = /(<TestAction[^>]*?)shouldUseLaunchSchemeArgsEnv\s*=\s*"YES"/;
const AMP_RE = /&/g;
const LT_RE = /</g;
const GT_RE = />/g;
const DQUOTE_RE = /"/g;
const SQUOTE_RE = /'/g;

const KNOWN_MACOS_PLANS: Record<string, string> = {
  full: 'macOS-Full',
  smoke: 'macOS-Smoke',
  'macos-full': 'macOS-Full',
  'macos-smoke': 'macOS-Smoke',
  'macOS-Full': 'macOS-Full',
  'macOS-Smoke': 'macOS-Smoke',
};

function parseMacOSArgs(argv: readonly string[]): { plan?: string; passthrough: string[] } {
  const passthrough: string[] = [];
  let plan: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a) continue;
    if (a === '--plan') {
      const next = argv[i + 1];
      if (!next || next.startsWith('-')) {
        throw new ArgsError('--plan requires a value (smoke | full)');
      }
      plan = KNOWN_MACOS_PLANS[next];
      if (!plan) {
        throw new ArgsError(
          `Unknown --plan "${next}". Valid plans: macOS-Full, macOS-Smoke (also: smoke, full).`,
        );
      }
      i++;
      continue;
    }
    if (a.startsWith('--plan=')) {
      const value = a.slice('--plan='.length);
      plan = KNOWN_MACOS_PLANS[value];
      if (!plan) {
        throw new ArgsError(
          `Unknown --plan "${value}". Valid plans: macOS-Full, macOS-Smoke (also: smoke, full).`,
        );
      }
      continue;
    }
    passthrough.push(a);
  }
  return { plan, passthrough };
}

const envFile = resolve(REPO_ROOT, '.env.local');
if (existsSync(envFile)) {
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

const { E2E_EMAIL, E2E_PASSWORD } = process.env;
if (!E2E_EMAIL || !E2E_PASSWORD) {
  console.error('❌ E2E_EMAIL and E2E_PASSWORD must be set in .env.local');
  process.exit(1);
}

if (!existsSync(SCHEME_PATH)) {
  console.error(`❌ Scheme not found at ${SCHEME_PATH} — run 'bun swift' first`);
  process.exit(1);
}

function escapeXml(s: string): string {
  return s
    .replace(AMP_RE, '&amp;')
    .replace(LT_RE, '&lt;')
    .replace(GT_RE, '&gt;')
    .replace(DQUOTE_RE, '&quot;')
    .replace(SQUOTE_RE, '&apos;');
}

function injectScheme({ email, password }: { email: string; password: string }): void {
  let content = readFileSync(SCHEME_PATH, 'utf8');
  content = content.replace(ENV_BLOCK_RE, '');
  content = content.replace(TEST_ACTION_INHERIT_RE, '$1shouldUseLaunchSchemeArgsEnv = "NO"');
  const block = [
    '      <EnvironmentVariables>',
    '         <EnvironmentVariable',
    '            key = "E2E_EMAIL"',
    `            value = "${escapeXml(email)}"`,
    '            isEnabled = "YES">',
    '         </EnvironmentVariable>',
    '         <EnvironmentVariable',
    '            key = "E2E_PASSWORD"',
    `            value = "${escapeXml(password)}"`,
    '            isEnabled = "YES">',
    '         </EnvironmentVariable>',
    '      </EnvironmentVariables>',
    '',
  ].join('\n');
  content = content.replace('   </TestAction>', `${block}   </TestAction>`);
  writeFileSync(SCHEME_PATH, content);
}

function allocateResultBundle(): string {
  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
  const path = resolve(RESULTS_DIR, `macOS-${stamp}.xcresult`);
  if (existsSync(path)) rmSync(path, { recursive: true, force: true });
  return path;
}

let parsed: ReturnType<typeof parseMacOSArgs>;
try {
  parsed = parseMacOSArgs(process.argv.slice(2));
} catch (err) {
  if (err instanceof ArgsError) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
  throw err;
}

injectScheme({ email: E2E_EMAIL, password: E2E_PASSWORD });
console.log('✓ Injected E2E credentials into PackRat-macOS scheme');

const resultBundle = allocateResultBundle();
console.log('→ Destination: platform=macOS');
if (parsed.plan) console.log(`→ Test plan: ${parsed.plan}`);
console.log(`→ Result bundle: ${resultBundle}`);

const planArgs = parsed.plan ? ['-testPlan', parsed.plan] : [];

const args = [
  'test',
  '-scheme',
  'PackRat-macOS',
  '-destination',
  'platform=macOS,arch=arm64',
  ...planArgs,
  '-resultBundlePath',
  resultBundle,
  ...parsed.passthrough,
];

const result = spawnSync('xcodebuild', args, {
  cwd: SWIFT_DIR,
  stdio: 'inherit',
  env: process.env,
});

try {
  const summary = readSummary(resultBundle);
  console.log('');
  console.log(formatSummaryLine(summary));
  if (summary.failingTests.length > 0) {
    console.log('  Failing tests:');
    for (const t of summary.failingTests) {
      console.log(`    • ${t.identifier}`);
    }
  }
} catch (err) {
  if (err instanceof XcResultError) {
    console.error(`⚠️  ${err.message}`);
  } else {
    throw err;
  }
}

process.exit(result.status ?? 1);
