import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

export type TestRef = {
  identifier: string;
  testName?: string;
  className?: string;
};

export type TestSummary = {
  totalTestCount: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  expectedFailures: number;
  passed: number;
  failed: number;
  skipped: number;
  result: string;
  failingTests: TestRef[];
};

export class XcResultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'XcResultError';
  }
}

type RawSummaryFailure = {
  // `testIdentifier` is a deprecated int64 in the Xcode 26 schema (formerly the row index).
  // Modern bundles populate `testIdentifierString` with the qualified name.
  testIdentifier?: number | string;
  testIdentifierString?: string;
  testName?: string;
  targetName?: string;
  className?: string;
};

type RawSummary = {
  result?: string;
  totalTestCount?: number;
  passedTests?: number;
  failedTests?: number;
  skippedTests?: number;
  expectedFailures?: number;
  testFailures?: RawSummaryFailure[];
};

export function parseSummaryJson(json: string): TestSummary {
  let raw: RawSummary;
  try {
    raw = JSON.parse(json) as RawSummary;
  } catch {
    throw new XcResultError('xcresulttool summary output was not valid JSON');
  }
  const failingTests: TestRef[] = (raw.testFailures ?? []).map((f) => {
    // Prefer the stable string identifier. Fall back to assembling one from
    // target+className+testName so we never surface a meaningless deprecated
    // int row index as the identifier the user sees in CI logs.
    const stringId = f.testIdentifierString;
    const assembled = f.testName
      ? [f.targetName, f.className, f.testName].filter(Boolean).join('/')
      : undefined;
    const numericFallback = typeof f.testIdentifier === 'string' ? f.testIdentifier : undefined;
    return {
      identifier: stringId ?? assembled ?? numericFallback ?? '<unknown>',
      testName: f.testName,
      className: f.className,
    };
  });
  const passed = raw.passedTests ?? 0;
  const failed = raw.failedTests ?? 0;
  const skipped = raw.skippedTests ?? 0;
  return {
    totalTestCount: raw.totalTestCount ?? passed + failed + skipped,
    passedTests: passed,
    failedTests: failed,
    skippedTests: skipped,
    expectedFailures: raw.expectedFailures ?? 0,
    passed,
    failed,
    skipped,
    result: raw.result ?? 'Unknown',
    failingTests,
  };
}

export function readSummary(bundlePath: string): TestSummary {
  if (!existsSync(bundlePath)) {
    throw new XcResultError(`xcresult bundle not found at ${bundlePath}`);
  }
  let stdout: string;
  try {
    stdout = execFileSync(
      'xcrun',
      ['xcresulttool', 'get', 'test-results', 'summary', '--path', bundlePath, '--compact'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new XcResultError(`xcresulttool get test-results summary failed: ${message}`);
  }
  return parseSummaryJson(stdout);
}

export function formatSummaryLine(s: TestSummary): string {
  const total = s.totalTestCount;
  const status = s.failed > 0 ? '❌' : s.passed > 0 ? '✅' : '⚠️';
  return `${status} ${s.passed}/${total} passed, ${s.failed} failed, ${s.skipped} skipped (result=${s.result})`;
}
