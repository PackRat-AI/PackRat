import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatSummaryLine, parseSummaryJson, XcResultError } from '../lib/xcresult';

const PASSING = readFileSync(resolve(__dirname, 'fixtures/passing-summary.json'), 'utf8');
const FAILING = readFileSync(resolve(__dirname, 'fixtures/failing-summary.json'), 'utf8');

describe('parseSummaryJson', () => {
  it('parses an all-green summary', () => {
    const s = parseSummaryJson(PASSING);
    expect(s.passed).toBe(12);
    expect(s.failed).toBe(0);
    expect(s.skipped).toBe(0);
    expect(s.totalTestCount).toBe(12);
    expect(s.result).toBe('Passed');
    expect(s.failingTests).toEqual([]);
  });

  it('parses failing tests and surfaces their identifiers', () => {
    const s = parseSummaryJson(FAILING);
    expect(s.passed).toBe(71);
    expect(s.failed).toBe(2);
    expect(s.skipped).toBe(1);
    expect(s.totalTestCount).toBe(74);
    expect(s.result).toBe('Failed');
    expect(s.failingTests.map((f) => f.identifier)).toEqual([
      'AuthTests/testLoginWithValidCredentials()',
      'CatalogTests/testCatalogSearchEmptyState()',
    ]);
  });

  it('throws XcResultError on malformed JSON', () => {
    expect(() => parseSummaryJson('not json')).toThrow(XcResultError);
  });

  it('defaults missing counts to zero rather than crashing', () => {
    const s = parseSummaryJson('{}');
    expect(s.passed).toBe(0);
    expect(s.failed).toBe(0);
    expect(s.skipped).toBe(0);
    expect(s.totalTestCount).toBe(0);
    expect(s.failingTests).toEqual([]);
  });
});

describe('formatSummaryLine', () => {
  it('formats a green run with the pass marker', () => {
    const line = formatSummaryLine(parseSummaryJson(PASSING));
    expect(line).toMatch(/✅ 12\/12 passed, 0 failed, 0 skipped/);
  });

  it('formats a red run with the fail marker and surfaces totals', () => {
    const line = formatSummaryLine(parseSummaryJson(FAILING));
    expect(line).toMatch(/❌ 71\/74 passed, 2 failed, 1 skipped/);
  });
});
