import { describe, expect, it } from 'vitest';
import {
  type CoverageSummary,
  compareWorkspace,
  loadBaseline,
  runRatchet,
  type WorkspaceBaseline,
} from '../coverage-ratchet';

function makeBaseline(overrides: Partial<WorkspaceBaseline> = {}): WorkspaceBaseline {
  return {
    summaryPath: 'pkg/coverage/coverage-summary.json',
    tier: 'A',
    lines: 80,
    branches: 70,
    functions: 90,
    statements: 80,
    recordedAt: '2026-05-17',
    ...overrides,
  };
}

function makeSummary(pct: number): CoverageSummary {
  return {
    total: {
      lines: { pct },
      branches: { pct },
      functions: { pct },
      statements: { pct },
    },
  };
}

function makeMixedSummary(
  lines: number,
  branches: number,
  functions: number,
  statements: number,
): CoverageSummary {
  return {
    total: {
      lines: { pct: lines },
      branches: { pct: branches },
      functions: { pct: functions },
      statements: { pct: statements },
    },
  };
}

describe('compareWorkspace', () => {
  it('passes when every metric matches or exceeds the baseline', () => {
    const result = compareWorkspace('pkg', makeBaseline(), makeMixedSummary(85, 75, 95, 85), 0.5);
    expect(result.status).toBe('improvement');
    expect(result.regressions).toBeUndefined();
  });

  it('passes (status=ok) when every metric is exactly the baseline', () => {
    const result = compareWorkspace('pkg', makeBaseline(), makeMixedSummary(80, 70, 90, 80), 0.5);
    expect(result.status).toBe('ok');
  });

  it('flags regression when one metric drops more than epsilon', () => {
    const result = compareWorkspace(
      'pkg',
      makeBaseline({ branches: 70 }),
      makeMixedSummary(80, 65, 90, 80),
      0.5,
    );
    expect(result.status).toBe('regression');
    expect(result.regressions).toEqual([{ metric: 'branches', before: 70, after: 65 }]);
  });

  it('tolerates noise below epsilon (default 0.5)', () => {
    // baseline 80.0 vs current 79.7 — within epsilon, not a regression.
    const result = compareWorkspace('pkg', makeBaseline(), makeMixedSummary(79.7, 70, 90, 80), 0.5);
    expect(result.status).toBe('ok');
  });

  it('rejects drops just above epsilon', () => {
    // baseline 80.0 vs current 79.4 — drop of 0.6 > epsilon 0.5.
    const result = compareWorkspace('pkg', makeBaseline(), makeMixedSummary(79.4, 70, 90, 80), 0.5);
    expect(result.status).toBe('regression');
    expect(result.regressions?.[0]?.metric).toBe('lines');
  });

  it('reports multiple regressions in one workspace', () => {
    const result = compareWorkspace('pkg', makeBaseline(), makeMixedSummary(60, 50, 70, 60), 0.5);
    expect(result.status).toBe('regression');
    expect(result.regressions).toHaveLength(4);
  });
});

describe('runRatchet', () => {
  it('passes when every workspace meets its baseline', () => {
    const baseline = {
      'packages/a': makeBaseline({
        summaryPath: 'a/coverage-summary.json',
        lines: 80,
        branches: 70,
        functions: 90,
        statements: 80,
      }),
      'packages/b': makeBaseline({
        summaryPath: 'b/coverage-summary.json',
        lines: 60,
        branches: 50,
        functions: 70,
        statements: 60,
      }),
    };
    const summaries: Record<string, CoverageSummary> = {
      'a/coverage-summary.json': makeMixedSummary(85, 75, 95, 85), // beats packages/a
      'b/coverage-summary.json': makeMixedSummary(70, 60, 80, 70), // beats packages/b
    };
    const report = runRatchet(baseline, 0.5, (path) => summaries[path] ?? null);
    expect(report.passed).toBe(true);
  });

  it('fails when any workspace regresses', () => {
    const baseline = {
      'packages/a': makeBaseline({
        summaryPath: 'a/coverage-summary.json',
        lines: 80,
        branches: 70,
        functions: 90,
        statements: 80,
      }),
      'packages/b': makeBaseline({
        summaryPath: 'b/coverage-summary.json',
        lines: 60,
        branches: 50,
        functions: 70,
        statements: 60,
      }),
    };
    const summaries: Record<string, CoverageSummary> = {
      'a/coverage-summary.json': makeSummary(85),
      'b/coverage-summary.json': makeSummary(40),
    };
    const report = runRatchet(baseline, 0.5, (path) => summaries[path] ?? null);
    expect(report.passed).toBe(false);
    const failed = report.checks.find((c) => c.workspace === 'packages/b');
    expect(failed?.status).toBe('regression');
  });

  it('fails when a workspace has no coverage summary on disk', () => {
    const baseline = {
      'packages/a': makeBaseline({
        summaryPath: 'missing/coverage-summary.json',
      }),
    };
    const report = runRatchet(baseline, 0.5, () => null);
    expect(report.passed).toBe(false);
    expect(report.checks[0]?.status).toBe('missing-summary');
  });

  it('fails when the summary file is missing required total metrics', () => {
    const baseline = {
      'packages/a': makeBaseline({ summaryPath: 'a/coverage-summary.json' }),
    };
    const malformed = { total: { lines: { pct: 80 } } } as unknown as CoverageSummary;
    const report = runRatchet(baseline, 0.5, (path) =>
      path === 'a/coverage-summary.json' ? malformed : null,
    );
    expect(report.passed).toBe(false);
    expect(report.checks[0]?.status).toBe('invalid-summary');
  });
});

describe('loadBaseline', () => {
  it('parses workspace entries and ignores comment keys', () => {
    const json = JSON.stringify({
      _comment: 'ignored',
      _epsilon: 0.3,
      'packages/a': {
        summaryPath: 'a/x.json',
        tier: 'A',
        lines: 80,
        branches: 70,
        functions: 90,
        statements: 80,
        recordedAt: '2026-05-17',
      },
    });
    const { baseline, epsilon } = loadBaseline(json);
    expect(epsilon).toBe(0.3);
    expect(Object.keys(baseline)).toEqual(['packages/a']);
    expect(baseline['packages/a']?.lines).toBe(80);
  });

  it('falls back to default epsilon when not specified', () => {
    const json = JSON.stringify({
      'packages/a': {
        summaryPath: 'a/x.json',
        tier: 'A',
        lines: 80,
        branches: 70,
        functions: 90,
        statements: 80,
        recordedAt: '2026-05-17',
      },
    });
    const { epsilon } = loadBaseline(json);
    expect(epsilon).toBe(0.05);
  });

  it('skips entries that look malformed', () => {
    const json = JSON.stringify({
      'packages/a': { summaryPath: 'a/x.json' }, // missing metric fields
      'packages/b': {
        summaryPath: 'b/x.json',
        tier: 'A',
        lines: 80,
        branches: 70,
        functions: 90,
        statements: 80,
        recordedAt: '2026-05-17',
      },
    });
    const { baseline } = loadBaseline(json);
    expect(Object.keys(baseline)).toEqual(['packages/b']);
  });
});
