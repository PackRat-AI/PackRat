#!/usr/bin/env bun
import { spawn, spawnSync } from 'node:child_process';
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
const PACKRAT_ENV = process.env.PACKRAT_ENV || 'local';

if (!existsSync(SCHEME_PATH)) {
  console.error(`❌ Scheme not found at ${SCHEME_PATH} — run 'bun swift' first`);
  process.exit(1);
}

function assertAutomationModeAvailable(): void {
  const result = spawnSync('automationmodetool', ['help'], {
    encoding: 'utf8',
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (output.includes('Automation Mode is disabled')) {
    if (output.includes('DOES NOT REQUIRE user authentication')) {
      console.warn(
        '⚠️  macOS Automation Mode is currently disabled, but XCTest can enable it without password authentication.',
      );
      return;
    }
    console.error('❌ macOS Automation Mode is disabled, so XCUITest cannot run unattended.');
    console.error(
      '   Run `automationmodetool enable-automationmode-without-authentication` and enter the macOS password once, then rerun this command.',
    );
    process.exit(1);
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

function withDefaultLocalSigningArgs(passthrough: readonly string[]): string[] {
  const hasSetting = (name: string) => passthrough.some((arg) => arg.startsWith(`${name}=`));
  const defaults = [
    'CODE_SIGN_STYLE=Manual',
    'DEVELOPMENT_TEAM=',
    'CODE_SIGN_IDENTITY=-',
    'CODE_SIGNING_ALLOWED=YES',
    'CODE_SIGNING_REQUIRED=NO',
  ];
  return [
    ...passthrough,
    ...defaults.filter((setting) => !hasSetting(setting.slice(0, setting.indexOf('=')))),
  ];
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
assertAutomationModeAvailable();

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
  ...withDefaultLocalSigningArgs(parsed.passthrough),
  // Same build-setting → Info.plist → Bundle.infoDictionary path as iOS —
  // see apps/swift/scripts/run-e2e.ts for the doc comment.
  `PACKRAT_E2E_EMAIL=${E2E_EMAIL}`,
  `PACKRAT_E2E_PASSWORD=${E2E_PASSWORD}`,
  `PACKRAT_ENV=${PACKRAT_ENV}`,
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function redactSecrets(output: string): string {
  let redacted = output;
  for (const secret of [E2E_EMAIL, E2E_PASSWORD]) {
    if (secret) {
      redacted = redacted.replace(new RegExp(escapeRegExp(secret), 'g'), '[REDACTED]');
    }
  }
  redacted = redacted.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]');
  redacted = redacted.replace(
    /[A-Z0-9._%+-]+@[A-Z0-9._%+-]+(?:\.\.\.|[A-Z0-9.-]*)?/gi,
    '[REDACTED_EMAIL]',
  );
  return redacted;
}

const resultStatus = await new Promise<number | null>((resolve) => {
  const child = spawn('xcodebuild', args, {
    cwd: SWIFT_DIR,
    env: process.env,
  });

  child.stdout.on('data', (chunk) => {
    process.stdout.write(redactSecrets(chunk.toString()));
  });
  child.stderr.on('data', (chunk) => {
    process.stderr.write(redactSecrets(chunk.toString()));
  });
  child.on('close', (code) => resolve(code));
});

const result = {
  status: resultStatus,
};

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
