#!/usr/bin/env bun
//
// coverage-baseline-update.ts — bumps coverage-baselines.json upward.
//
// For every workspace in `coverage-baselines.json`, read its current
// `coverage-summary.json` and update the baseline metric if (and only if)
// the current value is higher. Never lowers a baseline — that's what the
// ratchet is for.
//
// Designed to run on `main` post-merge from CI via:
//   `bun scripts/lint/coverage-baseline-update.ts`
// followed by an auto-commit of `coverage-baselines.json`. Do not invoke
// this from PR workflows — it would silently move the floor up before the
// PR's coverage drops below it.
//
// Exit code:
//   0 — file updated (or no changes needed)
//   1 — fatal error (missing baseline file, malformed summaries)
//
// Honours the same `_epsilon` value the ratchet uses — improvements smaller
// than epsilon are ignored so we don't churn the baseline on v8 jitter.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type BaselineFile,
  type CoverageSummary,
  loadBaseline,
  METRICS,
  type Metric,
  type WorkspaceBaseline,
} from './coverage-ratchet';

interface Bump {
  workspace: string;
  metric: Metric;
  before: number;
  after: number;
}

if (import.meta.main) {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const ROOT = join(HERE, '..', '..');
  const BASELINE_PATH = join(ROOT, 'coverage-baselines.json');

  if (!existsSync(BASELINE_PATH)) {
    console.error(`coverage-baselines.json not found at ${BASELINE_PATH}`);
    process.exit(1);
  }
  const raw = readFileSync(BASELINE_PATH, 'utf-8');
  const parsed = JSON.parse(raw) as BaselineFile;
  const { baseline, epsilon } = loadBaseline(raw);

  const today = new Date().toISOString().slice(0, 10);
  const bumps: Bump[] = [];

  for (const [workspace, entry] of Object.entries(baseline)) {
    const abs = join(ROOT, entry.summaryPath);
    if (!existsSync(abs)) {
      console.warn(`Skipping ${workspace} — no summary at ${entry.summaryPath}`);
      continue;
    }
    let summary: CoverageSummary;
    try {
      summary = JSON.parse(readFileSync(abs, 'utf-8')) as CoverageSummary;
    } catch (err) {
      console.warn(`Skipping ${workspace} — malformed summary: ${(err as Error).message}`);
      continue;
    }
    const next: WorkspaceBaseline = { ...entry };
    let changed = false;
    for (const metric of METRICS) {
      const before = entry[metric];
      const after = summary.total[metric].pct;
      if (after - before > epsilon) {
        next[metric] = after;
        changed = true;
        bumps.push({ workspace, metric, before, after });
      }
    }
    if (changed) {
      next.recordedAt = today;
      parsed[workspace] = next;
    }
  }

  if (bumps.length === 0) {
    console.log('Coverage baselines: no improvements above epsilon. File unchanged.');
    process.exit(0);
  }

  writeFileSync(BASELINE_PATH, `${JSON.stringify(parsed, null, 2)}\n`, 'utf-8');
  console.log(`Coverage baselines: bumped ${bumps.length} metric(s).`);
  for (const b of bumps) {
    console.log(`  ${b.workspace} ${b.metric}: ${b.before.toFixed(2)}% → ${b.after.toFixed(2)}%`);
  }
  process.exit(0);
}
