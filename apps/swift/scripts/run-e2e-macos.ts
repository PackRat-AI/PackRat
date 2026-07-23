#!/usr/bin/env bun
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
import {
  anyOf,
  caseInsensitive,
  charIn,
  createRegExp,
  global as globalFlag,
  maybe,
  oneOrMore,
} from 'magic-regexp';
import { ArgsError } from './lib/args';
import { ensureLocalE2EAPI } from './lib/e2e-api';
import { normalizeMacOSTestSelectors, parseMacOSArgs } from './lib/macos-args';
import { formatSummaryLine, readSummary, XcResultError } from './lib/xcresult';

const REPO_ROOT = resolve(import.meta.dir, '../../..');
const SWIFT_DIR = resolve(REPO_ROOT, 'apps/swift');
const SCHEME_PATH = resolve(
  SWIFT_DIR,
  'PackRat.xcodeproj/xcshareddata/xcschemes/PackRat-macOS.xcscheme',
);
const RESULTS_DIR = resolve(SWIFT_DIR, 'TestResults');
const EMAIL_RE = createRegExp(
  oneOrMore(charIn('A-Z0-9._%+-')),
  '@',
  oneOrMore(charIn('A-Z0-9.-')),
  '.',
  oneOrMore(charIn('A-Z')),
  [globalFlag, caseInsensitive],
);
const LOOSE_EMAIL_RE = createRegExp(
  oneOrMore(charIn('A-Z0-9._%+-')),
  '@',
  oneOrMore(charIn('A-Z0-9._%+-')),
  maybe(anyOf('...', oneOrMore(charIn('A-Z0-9.-')))),
  [globalFlag, caseInsensitive],
);
const QUOTE_RE = createRegExp(anyOf('"', "'"), [globalFlag]);

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

if (!existsSync(SCHEME_PATH)) {
  console.error(`❌ Scheme not found at ${SCHEME_PATH} — run 'bun swift' first`);
  process.exit(1);
}

const localAPI = await ensureLocalE2EAPI({ packratEnv: PACKRAT_ENV, env: process.env });
loadEnvFile(resolve(REPO_ROOT, 'packages/api/.dev.vars.e2e'), true);

const localE2ESessionToken = deriveLocalE2ESessionToken();
const allowLoginSeed = PACKRAT_ENV === 'local' || PACKRAT_ENV === 'dev-local';
const uiTestEmail = process.env.E2E_TEST_EMAIL ?? E2E_EMAIL;
const uiTestPassword = process.env.E2E_TEST_PASSWORD ?? E2E_PASSWORD;

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
  return Array.from(s, (char) => {
    if (char === '&') return '&amp;';
    if (char === '<') return '&lt;';
    if (char === '>') return '&gt;';
    if (char === '"') return '&quot;';
    if (char === "'") return '&apos;';
    return char;
  }).join('');
}

function deriveLocalE2ESessionToken(): string | undefined {
  if (PACKRAT_ENV !== 'local' && PACKRAT_ENV !== 'dev-local') return undefined;
  const secret = process.env.BETTER_AUTH_SECRET ?? 'e2e-better-auth-secret-at-least-32-chars';
  const email = process.env.E2E_TEST_EMAIL?.toLowerCase();
  const userId = process.env.E2E_TEST_USER_ID;
  if (!email || !userId) return undefined;
  const digest = createHash('sha256').update([secret, email, userId].join(':')).digest('hex');
  return `e2e-local.${digest}`;
}

type SchemeEnv = {
  email: string;
  password: string;
  sessionToken?: string;
  userId?: string;
  allowLoginSeed: boolean;
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

function injectScheme({ email, password, sessionToken, userId, allowLoginSeed }: SchemeEnv): void {
  let content = readFileSync(SCHEME_PATH, 'utf8');
  content = removeEnvironmentVariablesBlock(content);
  content = content.replace(
    'shouldUseLaunchSchemeArgsEnv = "YES"',
    'shouldUseLaunchSchemeArgsEnv = "NO"',
  );
  const variables = [
    environmentVariableXml('E2E_EMAIL', email),
    environmentVariableXml('E2E_PASSWORD', password),
    environmentVariableXml('PACKRAT_E2E_EMAIL', uiTestEmail),
    environmentVariableXml('PACKRAT_E2E_PASSWORD', uiTestPassword),
    environmentVariableXml('PACKRAT_E2E_ALLOW_LOGIN_SEED', allowLoginSeed ? '1' : '0'),
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
  content = content.replace('   </TestAction>', `${block}   </TestAction>`);
  writeFileSync(SCHEME_PATH, content);
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

injectScheme({
  email: E2E_EMAIL,
  password: E2E_PASSWORD,
  sessionToken: localE2ESessionToken,
  userId: process.env.E2E_TEST_USER_ID,
  allowLoginSeed,
});
console.log('✓ Injected E2E credentials into PackRat-macOS scheme');
assertAutomationModeAvailable();

const resultBundle = allocateResultBundle();
console.log('→ Destination: platform=macOS');
if (parsed.plan) console.log(`→ Test plan: ${parsed.plan}`);
console.log(`→ Result bundle: ${resultBundle}`);

const planArgs = parsed.plan ? ['-testPlan', parsed.plan] : [];
const macOSPassthrough = normalizeMacOSTestSelectors(parsed.passthrough);

const args = [
  'test',
  '-scheme',
  'PackRat-macOS',
  '-destination',
  'platform=macOS,arch=arm64',
  ...planArgs,
  '-resultBundlePath',
  resultBundle,
  ...withDefaultLocalSigningArgs(macOSPassthrough),
  // Same build-setting → Info.plist → Bundle.infoDictionary path as iOS —
  // see apps/swift/scripts/run-e2e.ts for the doc comment.
  `PACKRAT_E2E_EMAIL=${uiTestEmail}`,
  `PACKRAT_E2E_PASSWORD=${uiTestPassword}`,
  `PACKRAT_E2E_SESSION_TOKEN=${localE2ESessionToken ?? ''}`,
  `PACKRAT_E2E_USER_ID=${process.env.E2E_TEST_USER_ID ?? ''}`,
  `PACKRAT_E2E_ALLOW_LOGIN_SEED=${allowLoginSeed ? '1' : '0'}`,
  `PACKRAT_ENV=${PACKRAT_ENV}`,
];

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
      redacted = redacted.split(secret).join('[REDACTED]');
    }
  }
  redacted = redacted.replace(EMAIL_RE, '[REDACTED_EMAIL]');
  redacted = redacted.replace(LOOSE_EMAIL_RE, '[REDACTED_EMAIL]');
  return redacted;
}

let exitStatus = 1;
try {
  const resultStatus = await new Promise<number | null>((resolve, reject) => {
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
    child.once('error', reject);
    child.on('close', (code) => resolve(code));
  });
  exitStatus = resultStatus ?? 1;

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
} finally {
  await localAPI.stop();
}

process.exit(exitStatus);
