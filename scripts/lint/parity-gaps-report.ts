#!/usr/bin/env bun
//
// parity-gaps-report.ts — renders the open parity gaps as markdown.
//
// The gap list is *derived*, never authored: the source of truth is the set of
// open issues labelled `parity`, each one opened automatically by
// .github/workflows/parity.yml when a PR declared `follow: <platform>`.
// Nobody maintains this file, so it cannot go stale the way
// docs/audits/2026-05-20-feature-parity-matrix.md did.
//
// Ages every gap so a long-open obligation is visible rather than merely
// present in a list nobody scrolls.
//
// Usage:
//   bun scripts/lint/parity-gaps-report.ts                  # write docs/parity/OPEN-GAPS.md
//   bun scripts/lint/parity-gaps-report.ts --stdout         # print instead
//   bun scripts/lint/parity-gaps-report.ts --max-age 30     # exit 1 past that age

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { PLATFORM_LABELS, PLATFORMS, type Platform } from './check-parity-declaration';

const ROOT = join(import.meta.dir, '..', '..');
const OUTPUT_PATH = join(ROOT, 'docs', 'parity', 'OPEN-GAPS.md');

/** Shape of the `gh issue list --json` rows this script consumes. */
export interface GapIssue {
  number: number;
  title: string;
  url: string;
  createdAt: string;
  labels: Array<{ name: string }>;
}

export interface Gap {
  number: number;
  title: string;
  url: string;
  platform: Platform | 'unknown';
  ageDays: number;
}

/** Age in whole days, floored, never negative. */
export function ageInDays(createdAt: string, now: Date): number {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return 0;
  return Math.max(0, Math.floor((now.getTime() - created) / 86_400_000));
}

/** Which client owes the work, read off the `parity:<platform>` label. */
export function platformFromLabels(labels: Array<{ name: string }>): Platform | 'unknown' {
  for (const { name } of labels) {
    const match = name.match(/^parity:(.+)$/);
    const candidate = match?.[1];
    if (candidate && (PLATFORMS as readonly string[]).includes(candidate)) {
      return candidate as Platform;
    }
  }
  return 'unknown';
}

export function toGaps(issues: GapIssue[], now: Date): Gap[] {
  return issues
    .map((issue) => ({
      number: issue.number,
      title: issue.title,
      url: issue.url,
      platform: platformFromLabels(issue.labels),
      ageDays: ageInDays(issue.createdAt, now),
    }))
    .sort((a, b) => b.ageDays - a.ageDays);
}

/** Oldest-first is deliberate: the top of the table is what needs attention. */
export function renderReport(gaps: Gap[], now: Date): string {
  const stamp = now.toISOString().slice(0, 10);
  const lines: string[] = [
    '# Open parity gaps',
    '',
    '> **Generated file — do not edit.**',
    '> Produced by `scripts/lint/parity-gaps-report.ts` from open issues labelled',
    '> `parity`. Close the issue to close the gap; this file follows automatically.',
    '',
    `_Last generated: ${stamp}_`,
    '',
  ];

  if (gaps.length === 0) {
    lines.push('**No open parity gaps.** Both clients are level.', '');
    return lines.join('\n');
  }

  const byPlatform = (platform: Platform) => gaps.filter((gap) => gap.platform === platform);

  lines.push('## Summary', '');
  lines.push('| Owed on | Open gaps | Oldest |');
  lines.push('|---|---|---|');
  for (const platform of PLATFORMS) {
    const owed = byPlatform(platform);
    const oldest = owed[0] ? `${owed[0].ageDays}d` : '—';
    lines.push(`| ${PLATFORM_LABELS[platform]} | ${owed.length} | ${oldest} |`);
  }
  lines.push('', '## Gaps', '', '| Age | Owed on | Gap |', '|---|---|---|');

  for (const gap of gaps) {
    const label = gap.platform === 'unknown' ? '_unlabelled_' : PLATFORM_LABELS[gap.platform];
    // Bare ages read as fine at a glance; the marker is what makes staleness pop.
    const age = gap.ageDays >= 30 ? `⚠️ ${gap.ageDays}d` : `${gap.ageDays}d`;
    lines.push(`| ${age} | ${label} | [#${gap.number}](${gap.url}) ${gap.title} |`);
  }
  lines.push('');
  return lines.join('\n');
}

/** Gaps past the age threshold — the signal that a follow-up is being dropped. */
export function findStaleGaps(gaps: Gap[], maxAgeDays: number): Gap[] {
  return gaps.filter((gap) => gap.ageDays > maxAgeDays);
}

// ── CLI ────────────────────────────────────────────────────────────────────

function fetchIssues(): GapIssue[] {
  const result = Bun.spawnSync([
    'gh',
    'issue',
    'list',
    '--label',
    'parity',
    '--state',
    'open',
    '--limit',
    '200',
    '--json',
    'number,title,url,createdAt,labels',
  ]);

  if (result.exitCode !== 0) {
    const stderr = new TextDecoder().decode(result.stderr).trim();
    throw new Error(`gh issue list failed: ${stderr || `exit ${result.exitCode}`}`);
  }
  return JSON.parse(new TextDecoder().decode(result.stdout));
}

function main(): void {
  const args = process.argv.slice(2);
  const maxAgeIdx = args.indexOf('--max-age');
  const maxAgeDays = maxAgeIdx === -1 ? null : Number(args[maxAgeIdx + 1]);

  const now = new Date();
  const gaps = toGaps(fetchIssues(), now);
  const report = renderReport(gaps, now);

  if (args.includes('--stdout')) {
    console.log(report);
  } else {
    mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
    writeFileSync(OUTPUT_PATH, report);
    console.log(`✅ parity: wrote ${gaps.length} open gap(s) to docs/parity/OPEN-GAPS.md`);
  }

  if (maxAgeDays !== null && !Number.isNaN(maxAgeDays)) {
    const stale = findStaleGaps(gaps, maxAgeDays);
    if (stale.length > 0) {
      console.error(`\n⚠️  ${stale.length} parity gap(s) older than ${maxAgeDays} days:\n`);
      for (const gap of stale) {
        console.error(`  #${gap.number} (${gap.ageDays}d) ${gap.title}`);
      }
      process.exit(1);
    }
  }
}

if (import.meta.main) {
  main();
}
