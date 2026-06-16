#!/usr/bin/env bun
//
// coverage-ratchet.ts — enforces per-workspace coverage baselines.
//
// Reads `coverage-baselines.json` at the repo root, then for each workspace
// entry reads its coverage summary (vitest's `coverage-summary.json`,
// emitted by the `json-summary` reporter) and compares each metric (lines /
// branches / functions / statements) to the baseline.
//
// A regression on any metric fails the run. A workspace that's in the
// baseline but missing a coverage summary also fails — silent skipping is
// exactly the mode the ratchet exists to prevent.
//
// Exit code:
//   0 — every baseline metric met or exceeded
//   1 — at least one regression (or missing summary)
//
// Coverage *improvements* are reported but never required to update the
// baseline locally; the `coverage-baseline-update.ts` script handles that
// on the main branch via CI.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const METRICS = ['lines', 'branches', 'functions', 'statements'] as const;
export type Metric = (typeof METRICS)[number];

export interface WorkspaceBaseline {
  summaryPath: string;
  tier: 'A' | 'B' | 'C';
  lines: number;
  branches: number;
  functions: number;
  statements: number;
  recordedAt: string;
}

export interface BaselineFile {
  _comment?: string;
  _epsilon?: number;
  [workspace: string]: WorkspaceBaseline | string | number | undefined;
}

export interface CoverageSummary {
  total: {
    lines: { pct: number };
    branches: { pct: number };
    functions: { pct: number };
    statements: { pct: number };
  };
}

export interface RatchetCheck {
  workspace: string;
  status: 'ok' | 'regression' | 'improvement' | 'missing-summary' | 'invalid-summary';
  before?: Record<Metric, number>;
  after?: Record<Metric, number>;
  regressions?: Array<{ metric: Metric; before: number; after: number }>;
  message?: string;
}

export interface RatchetReport {
  checks: RatchetCheck[];
  passed: boolean;
}

const DEFAULT_EPSILON = 0.05;

function isBaselineEntry(v: unknown): v is WorkspaceBaseline {
  if (v === null || typeof v !== 'object') return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.summaryPath === 'string' &&
    typeof e.lines === 'number' &&
    typeof e.branches === 'number' &&
    typeof e.functions === 'number' &&
    typeof e.statements === 'number'
  );
}

export function loadBaseline(baselineJson: string): {
  baseline: Record<string, WorkspaceBaseline>;
  epsilon: number;
} {
  const parsed = JSON.parse(baselineJson) as BaselineFile;
  const epsilon = typeof parsed._epsilon === 'number' ? parsed._epsilon : DEFAULT_EPSILON;
  const baseline: Record<string, WorkspaceBaseline> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (key.startsWith('_')) continue;
    if (isBaselineEntry(value)) baseline[key] = value;
  }
  return { baseline, epsilon };
}

export function compareWorkspace(
  workspace: string,
  baseline: WorkspaceBaseline,
  summary: CoverageSummary,
  epsilon: number,
): RatchetCheck {
  const before: Record<Metric, number> = {
    lines: baseline.lines,
    branches: baseline.branches,
    functions: baseline.functions,
    statements: baseline.statements,
  };
  const after: Record<Metric, number> = {
    lines: summary.total.lines.pct,
    branches: summary.total.branches.pct,
    functions: summary.total.functions.pct,
    statements: summary.total.statements.pct,
  };
  const regressions: Array<{ metric: Metric; before: number; after: number }> = [];
  let improved = false;
  for (const metric of METRICS) {
    const drop = before[metric] - after[metric];
    if (drop > epsilon) {
      regressions.push({ metric, before: before[metric], after: after[metric] });
    } else if (after[metric] - before[metric] > epsilon) {
      improved = true;
    }
  }
  if (regressions.length > 0) {
    return { workspace, status: 'regression', before, after, regressions };
  }
  if (improved) {
    return { workspace, status: 'improvement', before, after };
  }
  return { workspace, status: 'ok', before, after };
}

export function runRatchet(
  baseline: Record<string, WorkspaceBaseline>,
  epsilon: number,
  readSummary: (path: string) => CoverageSummary | null,
): RatchetReport {
  const checks: RatchetCheck[] = [];
  for (const [workspace, entry] of Object.entries(baseline)) {
    const summary = readSummary(entry.summaryPath);
    if (summary === null) {
      checks.push({
        workspace,
        status: 'missing-summary',
        message: `no coverage summary at ${entry.summaryPath} — run the workspace's coverage script before the ratchet`,
      });
      continue;
    }
    if (
      typeof summary?.total?.lines?.pct !== 'number' ||
      typeof summary?.total?.branches?.pct !== 'number' ||
      typeof summary?.total?.functions?.pct !== 'number' ||
      typeof summary?.total?.statements?.pct !== 'number'
    ) {
      checks.push({
        workspace,
        status: 'invalid-summary',
        message: `coverage summary at ${entry.summaryPath} is missing required total metrics`,
      });
      continue;
    }
    checks.push(compareWorkspace(workspace, entry, summary, epsilon));
  }
  const passed = checks.every((c) => c.status === 'ok' || c.status === 'improvement');
  return { checks, passed };
}

function fmtPct(n: number): string {
  return `${n.toFixed(2)}%`;
}

function renderReport(report: RatchetReport): string {
  const lines: string[] = [];
  const DIVIDER = '─'.repeat(60);
  lines.push('\nCoverage Ratchet');
  lines.push(DIVIDER);
  for (const c of report.checks) {
    if (c.status === 'ok') {
      lines.push(`✅  ${c.workspace} — baseline met`);
    } else if (c.status === 'improvement') {
      lines.push(`📈  ${c.workspace} — coverage improved (CI on main will bump baseline)`);
      if (c.before && c.after) {
        for (const m of METRICS) {
          if (c.after[m] - c.before[m] > 0.05) {
            lines.push(`     ${m}: ${fmtPct(c.before[m])} → ${fmtPct(c.after[m])}`);
          }
        }
      }
    } else if (c.status === 'regression' && c.regressions) {
      lines.push(`❌  ${c.workspace} — REGRESSION:`);
      for (const r of c.regressions) {
        lines.push(`     ${r.metric}: ${fmtPct(r.before)} → ${fmtPct(r.after)}`);
      }
    } else if (c.status === 'missing-summary' || c.status === 'invalid-summary') {
      lines.push(`❌  ${c.workspace} — ${c.message}`);
    }
  }
  lines.push(DIVIDER);
  if (report.passed) {
    lines.push('All workspaces ≥ baseline.');
  } else {
    lines.push('One or more workspaces regressed. Run the workspace coverage');
    lines.push('script locally to reproduce, add tests for the affected files,');
    lines.push('and commit until the ratchet passes. See docs/testing.md.');
  }
  return lines.join('\n');
}

if (import.meta.main) {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const ROOT = join(HERE, '..', '..');
  const BASELINE_PATH = join(ROOT, 'coverage-baselines.json');

  if (!existsSync(BASELINE_PATH)) {
    console.error(`coverage-baselines.json not found at ${BASELINE_PATH}`);
    process.exit(1);
  }
  const { baseline, epsilon } = loadBaseline(readFileSync(BASELINE_PATH, 'utf-8'));

  const report = runRatchet(baseline, epsilon, (relPath) => {
    const abs = join(ROOT, relPath);
    if (!existsSync(abs)) return null;
    try {
      return JSON.parse(readFileSync(abs, 'utf-8')) as CoverageSummary;
    } catch {
      return null;
    }
  });

  console.log(renderReport(report));
  process.exit(report.passed ? 0 : 1);
}
