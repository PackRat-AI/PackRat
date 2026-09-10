#!/usr/bin/env bun
//
// open-counterpart-issue.ts — turns a merged PR's `follow: <platform>`
// declaration into a tracked parity gap.
//
// Runs from .github/workflows/parity.yml on merge. This is the step that makes
// the system work without anyone remembering: the obligation is recorded at the
// one moment the context is free, by the machine rather than the person.
//
// Idempotent — a re-run or a re-merge finds the existing issue by its
// `parity-of:#<pr>` marker and does nothing. Duplicate gap issues would train
// people to ignore the label, which would end the whole scheme.
//
// Exit code: 0 always on the happy paths (including "nothing owed"); 1 only if
// the gh call itself fails.

import { readFileSync } from 'node:fs';
import {
  otherPlatform,
  PLATFORM_LABELS,
  type Platform,
  parseParityDeclaration,
  platformsTouched,
} from '../lint/check-parity-declaration';

export interface PrContext {
  number: number;
  title: string;
  url: string;
  author: string;
}

const LINE_SPLIT_RE = /\r?\n/;

/** Marker that makes the counterpart issue findable on a re-run. */
export function parityMarker(prNumber: number): string {
  return `parity-of:#${prNumber}`;
}

export function issueTitle(target: Platform, prTitle: string): string {
  const prefix = target === 'swift' ? '[parity/swift]' : '[parity/expo]';
  return `${prefix} ${prTitle}`;
}

export interface IssueBodyInput {
  pr: PrContext;
  landedOn: Platform[];
  target: Platform;
  note?: string | undefined;
}

export function issueBody({ pr, landedOn, target, note }: IssueBodyInput): string {
  const from = landedOn.map((platform) => PLATFORM_LABELS[platform]).join(' + ');
  return [
    `Counterpart work owed on **${PLATFORM_LABELS[target]}**.`,
    '',
    `Landed on ${from} in ${pr.url} (@${pr.author}).`,
    ...(note ? ['', `> ${note}`] : []),
    '',
    '---',
    '',
    '**To close this gap:** apply the equivalent change on ' +
      `${PLATFORM_LABELS[target]}, then close this issue. Reference ${pr.url} ` +
      'for what shipped — behaviour should match, but the implementation should ' +
      'be idiomatic to the platform rather than a transliteration.',
    '',
    `If parity turns out not to apply here, close with a comment saying why.`,
    '',
    `<!-- ${parityMarker(pr.number)} -->`,
  ].join('\n');
}

/** Labels for the new issue: the rollup label plus the owed-platform label. */
export function issueLabels(target: Platform): string[] {
  return ['parity', `parity:${target}`];
}

function gh(args: string[]): { ok: boolean; stdout: string; stderr: string } {
  const result = Bun.spawnSync(['gh', ...args]);
  return {
    ok: result.exitCode === 0,
    stdout: new TextDecoder().decode(result.stdout).trim(),
    stderr: new TextDecoder().decode(result.stderr).trim(),
  };
}

/** True when a counterpart issue for this PR already exists (any state). */
export function findExisting(prNumber: number, repo: string): string | null {
  const marker = parityMarker(prNumber);
  const result = gh([
    'issue',
    'list',
    '--repo',
    repo,
    '--label',
    'parity',
    '--state',
    'all',
    '--limit',
    '200',
    '--search',
    marker,
    '--json',
    'number,url,body',
  ]);
  if (!result.ok) return null;

  try {
    const rows: Array<{ url: string; body: string }> = JSON.parse(result.stdout);
    return rows.find((row) => row.body?.includes(marker))?.url ?? null;
  } catch {
    return null;
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`❌ parity: missing required env var ${name}`);
    process.exit(1);
  }
  return value;
}

function main(): void {
  const args = process.argv.slice(2);
  const bodyPath = args[args.indexOf('--body') + 1];
  const filesPath = args[args.indexOf('--changed-files') + 1];

  if (!bodyPath || !filesPath) {
    console.error('usage: open-counterpart-issue.ts --body <file> --changed-files <file>');
    process.exit(2);
  }

  const pr: PrContext = {
    number: Number(requireEnv('PR_NUMBER')),
    title: requireEnv('PR_TITLE'),
    url: requireEnv('PR_URL'),
    author: requireEnv('PR_AUTHOR'),
  };
  const repo = requireEnv('REPO');

  const changedFiles = readFileSync(filesPath, 'utf-8')
    .split(LINE_SPLIT_RE)
    .map((line) => line.trim())
    .filter(Boolean);
  const landedOn = platformsTouched(changedFiles);

  if (landedOn.length === 0) {
    console.log('parity: PR touched no client code — nothing to record.');
    return;
  }

  const { directive } = parseParityDeclaration(readFileSync(bodyPath, 'utf-8'), landedOn);

  // A merged PR whose declaration is malformed shouldn't fail the merge — the
  // `validate` job already had its chance to block it. Report and move on.
  if (!directive) {
    console.log('parity: no valid declaration on a merged PR — nothing recorded.');
    return;
  }

  if (directive.kind !== 'follow') {
    console.log(`parity: declared "${directive.kind}" — no counterpart issue needed.`);
    return;
  }

  const target = directive.target;
  // Guard the degenerate case: a both-clients PR that still declared a follow.
  if (landedOn.length === 1 && landedOn[0] === target) {
    console.log(`parity: declared follow on ${target}, which is where it landed — skipping.`);
    return;
  }

  const existing = findExisting(pr.number, repo);
  if (existing) {
    console.log(`parity: counterpart issue already exists — ${existing}`);
    return;
  }

  const result = gh([
    'issue',
    'create',
    '--repo',
    repo,
    '--title',
    issueTitle(target, pr.title),
    '--body',
    issueBody({ pr, landedOn, target, note: directive.note }),
    ...issueLabels(target).flatMap((label) => ['--label', label]),
  ]);

  if (!result.ok) {
    console.error(`❌ parity: failed to create counterpart issue: ${result.stderr}`);
    process.exit(1);
  }

  console.log(
    `✅ parity: opened counterpart issue for ${PLATFORM_LABELS[target]} — ${result.stdout}`,
  );
}

// Exported for tests; `otherPlatform` re-exported so callers have the full model.
export { otherPlatform };

if (import.meta.main) {
  main();
}
