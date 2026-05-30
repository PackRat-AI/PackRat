#!/usr/bin/env bun
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
/**
 * Run PackRat Swift XCUITests with credentials loaded from .env.local.
 *
 * Usage:  bun e2e:swift                           (run iOS-Full plan — all UI tests)
 *         bun e2e:swift --plan smoke              (run iOS-Smoke plan — Auth + Navigation)
 *         bun e2e:swift --plan full               (run iOS-Full plan explicitly)
 *         bun e2e:swift -only-testing:<id>        (narrow to a specific test)
 *
 * Required env vars (in .env.local):
 *   E2E_EMAIL
 *   E2E_PASSWORD
 *
 * How credentials reach the test runner:
 *   xcodebuild reads the scheme's TestAction EnvironmentVariables when
 *   launching XCTRunner. We inject E2E_EMAIL/E2E_PASSWORD into that block
 *   in the .xcscheme XML before invoking xcodebuild test. The scheme is
 *   regenerated from project.yml on every `bun swift`, so this edit is
 *   ephemeral and safe.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ArgsError, parseArgs } from './lib/args';
import { listBootedIOS } from './lib/simctl';
import { formatSummaryLine, readSummary, XcResultError } from './lib/xcresult';

const REPO_ROOT = resolve(import.meta.dir, '../../..');
const SWIFT_DIR = resolve(REPO_ROOT, 'apps/swift');
const SCHEME_PATH = resolve(
  SWIFT_DIR,
  'PackRat.xcodeproj/xcshareddata/xcschemes/PackRat-iOS.xcscheme',
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

// ── Load .env.local ───────────────────────────────────────────────────────────

function loadEnvFile(path: string, override = false): void {
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
    if (override || process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(resolve(REPO_ROOT, '.env.local'));
loadEnvFile(resolve(REPO_ROOT, 'packages/api/.dev.vars'), true);
loadEnvFile(resolve(REPO_ROOT, 'packages/api/.dev.vars.e2e'), true);

const { E2E_EMAIL, E2E_PASSWORD } = process.env;
if (!E2E_EMAIL || !E2E_PASSWORD) {
  console.error('❌ E2E_EMAIL and E2E_PASSWORD must be set in .env.local');
  process.exit(1);
}
const PACKRAT_ENV = process.env.PACKRAT_ENV || 'local';
const localE2ESessionToken = deriveLocalE2ESessionToken();
const uiTestEmail = process.env.E2E_TEST_EMAIL ?? E2E_EMAIL;
const uiTestPassword = process.env.E2E_TEST_PASSWORD ?? E2E_PASSWORD;

if (!existsSync(SCHEME_PATH)) {
  console.error(`❌ Scheme not found at ${SCHEME_PATH} — run 'bun swift' first`);
  process.exit(1);
}

// ── Inject credentials into scheme ───────────────────────────────────────────

function escapeXml(s: string): string {
  return s
    .replace(AMP_RE, '&amp;')
    .replace(LT_RE, '&lt;')
    .replace(GT_RE, '&gt;')
    .replace(DQUOTE_RE, '&quot;')
    .replace(SQUOTE_RE, '&apos;');
}

function deriveLocalE2ESessionToken(): string | undefined {
  const dbUrl = process.env.NEON_DATABASE_URL ?? '';
  const secret = process.env.BETTER_AUTH_SECRET;
  const email = process.env.E2E_TEST_EMAIL?.toLowerCase();
  const userId = process.env.E2E_TEST_USER_ID;
  if (!(dbUrl.includes('127.0.0.1') || dbUrl.includes('localhost'))) return undefined;
  if (!secret || !email || !userId) return undefined;
  const digest = createHash('sha256').update([secret, email, userId].join(':')).digest('hex');
  return `e2e-local.${digest}`;
}

type SchemeEnv = {
  email: string;
  password: string;
  sessionToken?: string;
  userId?: string;
};

function environmentVariableXml(key: string, value: string): string {
  return [
    '         <EnvironmentVariable',
    `            key = "${escapeXml(key)}"`,
    `            value = "${escapeXml(value)}"`,
    '            isEnabled = "YES">',
    '         </EnvironmentVariable>',
  ].join('\n');
}

function injectScheme({ email, password, sessionToken, userId }: SchemeEnv): void {
  let content = readFileSync(SCHEME_PATH, 'utf8');

  // Strip any prior EnvironmentVariables block (idempotent re-runs).
  content = content.replace(ENV_BLOCK_RE, '');

  // Force TestAction to use its own env vars rather than inheriting from Run.
  content = content.replace(TEST_ACTION_INHERIT_RE, '$1shouldUseLaunchSchemeArgsEnv = "NO"');

  const variables = [
    environmentVariableXml('E2E_EMAIL', email),
    environmentVariableXml('E2E_PASSWORD', password),
    environmentVariableXml('PACKRAT_E2E_EMAIL', uiTestEmail),
    environmentVariableXml('PACKRAT_E2E_PASSWORD', uiTestPassword),
  ];
  if (sessionToken)
    variables.push(environmentVariableXml('PACKRAT_E2E_SESSION_TOKEN', sessionToken));
  if (userId) variables.push(environmentVariableXml('PACKRAT_E2E_USER_ID', userId));

  const block = [
    '      <EnvironmentVariables>',
    ...variables,
    '      </EnvironmentVariables>',
    '',
  ].join('\n');

  // Insert before </TestAction>.
  content = content.replace('   </TestAction>', `${block}   </TestAction>`);

  writeFileSync(SCHEME_PATH, content);
}

// ── Pick destination ─────────────────────────────────────────────────────────

function pickDestination(): string {
  try {
    const booted = listBootedIOS();
    if (booted.length > 0) return `platform=iOS Simulator,id=${booted[0]}`;
  } catch {}
  return 'platform=iOS Simulator,name=iPhone 17 Pro';
}

// ── Allocate result bundle ───────────────────────────────────────────────────

function allocateResultBundle(): string {
  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
  const path = resolve(RESULTS_DIR, `${stamp}.xcresult`);
  // xcresulttool refuses to overwrite — make sure the slot is clean (matters on tight clock skew).
  if (existsSync(path)) rmSync(path, { recursive: true, force: true });
  return path;
}

// ── Parse args ───────────────────────────────────────────────────────────────

let parsed: ReturnType<typeof parseArgs>;
try {
  parsed = parseArgs(process.argv.slice(2));
} catch (err) {
  if (err instanceof ArgsError) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
  throw err;
}

// ── Run xcodebuild ───────────────────────────────────────────────────────────

injectScheme({
  email: E2E_EMAIL,
  password: E2E_PASSWORD,
  sessionToken: localE2ESessionToken,
  userId: process.env.E2E_TEST_USER_ID,
});
console.log('✓ Injected E2E credentials into scheme');

const dest = pickDestination();
const resultBundle = allocateResultBundle();
console.log(`→ Destination: ${dest}`);
if (parsed.plan) console.log(`→ Test plan: ${parsed.plan}`);
console.log(`→ Result bundle: ${resultBundle}`);

const planArgs = parsed.plan ? ['-testPlan', parsed.plan] : [];

const args = [
  'test',
  '-scheme',
  'PackRat-iOS',
  '-destination',
  dest,
  ...planArgs,
  '-resultBundlePath',
  resultBundle,
  ...parsed.passthrough,
  // Build settings — substituted into the UITests target's Info.plist
  // (PACKRAT_E2E_EMAIL / PACKRAT_E2E_PASSWORD entries) at build time. The
  // test class reads them via Bundle.main.infoDictionary at runtime. This
  // is the documented Apple pattern for "secrets into a test bundle" —
  // no file patching, no .local overrides.
  `PACKRAT_E2E_EMAIL=${uiTestEmail}`,
  `PACKRAT_E2E_PASSWORD=${uiTestPassword}`,
  `PACKRAT_E2E_SESSION_TOKEN=${localE2ESessionToken ?? ''}`,
  `PACKRAT_E2E_USER_ID=${process.env.E2E_TEST_USER_ID ?? ''}`,
  `PACKRAT_ENV=${PACKRAT_ENV}`,
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function redactSecrets(output: string): string {
  let redacted = output;
  for (const secret of [
    E2E_EMAIL,
    E2E_PASSWORD,
    uiTestEmail,
    uiTestPassword,
    process.env.E2E_TEST_EMAIL,
    localE2ESessionToken,
  ]) {
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

// xcodebuild test exits non-zero on test failure but the result bundle is still valid;
// always try to summarize, then propagate the original exit code.
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
