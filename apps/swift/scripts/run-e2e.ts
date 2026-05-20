#!/usr/bin/env bun
import { spawnSync } from 'node:child_process';
/**
 * Run PackRat Swift XCUITests with credentials loaded from .env.local.
 *
 * Usage:  bun e2e:swift                           (run all UI tests)
 *         bun e2e:swift -only-testing:<id>        (run a specific test method)
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
import { listBooted } from './lib/simctl';
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

// ── Inject credentials into scheme ───────────────────────────────────────────

function escapeXml(s: string): string {
  return s
    .replace(AMP_RE, '&amp;')
    .replace(LT_RE, '&lt;')
    .replace(GT_RE, '&gt;')
    .replace(DQUOTE_RE, '&quot;')
    .replace(SQUOTE_RE, '&apos;');
}

function injectScheme(email: string, password: string): void {
  let content = readFileSync(SCHEME_PATH, 'utf8');

  // Strip any prior EnvironmentVariables block (idempotent re-runs).
  content = content.replace(ENV_BLOCK_RE, '');

  // Force TestAction to use its own env vars rather than inheriting from Run.
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

  // Insert before </TestAction>.
  content = content.replace('   </TestAction>', `${block}   </TestAction>`);

  writeFileSync(SCHEME_PATH, content);
}

// ── Pick destination ─────────────────────────────────────────────────────────

function pickDestination(): string {
  try {
    const booted = listBooted();
    if (booted.length > 0) return `platform=iOS Simulator,id=${booted[0]}`;
  } catch {}
  return 'platform=iOS Simulator,name=iPhone 17 Pro';
}

// ── Allocate result bundle ───────────────────────────────────────────────────

function allocateResultBundle(): string {
  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const path = resolve(RESULTS_DIR, `${stamp}.xcresult`);
  // xcresulttool refuses to overwrite — make sure the slot is clean (matters on tight clock skew).
  if (existsSync(path)) rmSync(path, { recursive: true, force: true });
  return path;
}

// ── Run xcodebuild ───────────────────────────────────────────────────────────

injectScheme(E2E_EMAIL, E2E_PASSWORD);
console.log('✓ Injected E2E credentials into scheme');

const dest = pickDestination();
const resultBundle = allocateResultBundle();
console.log(`→ Destination: ${dest}`);
console.log(`→ Result bundle: ${resultBundle}`);

const args = [
  'test',
  '-scheme',
  'PackRat-iOS',
  '-destination',
  dest,
  '-only-testing:PackRatUITests',
  '-resultBundlePath',
  resultBundle,
  ...process.argv.slice(2),
];

const result = spawnSync('xcodebuild', args, {
  cwd: SWIFT_DIR,
  stdio: 'inherit',
  env: process.env,
});

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
