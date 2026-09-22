#!/usr/bin/env bun
//
// check-parity-declaration.ts — enforces that every PR declares what happens
// to the *other* client.
//
// Why: PackRat ships two clients from one repo — `apps/swift` (iOS + macOS)
// and `apps/expo` (Android). Work lands on whichever one you happen to be in,
// and the counterpart is supposed to follow. Nothing remembers that except the
// person who was there, so it silently doesn't happen.
//
// The fix is *not* a master parity document — docs/audits/2026-05-20 was that,
// and it rotted in eleven weeks because nothing recomputed it. Instead the
// obligation is captured per-change, at merge time, when the context is free.
// See docs/parity.md for the full rationale.
//
// This lint only validates the declaration in the PR body. Acting on it (opening
// the counterpart issue) is `.github/workflows/parity.yml`.
//
// What gets flagged:
//   - MISSING BLOCK:   no `## Parity` section in the PR body
//   - NO DIRECTIVE:    the section exists but declares no recognised directive
//   - BAD PLATFORM:    `follow:` names something that isn't a known platform
//   - SELF FOLLOW:     `follow:` names the platform the change already landed on
//   - MISSING REASON:  `n/a:` with no justification after it
//   - AMBIGUOUS:       more than one directive declared at once
//
// Exit code:
//   0 — declaration present and well-formed (or the PR touches no client code)
//   1 — any violation above

import { readFileSync } from 'node:fs';

// ── platforms ──────────────────────────────────────────────────────────────

// The two shipping clients. Deliberately *not* "ios/android/macos" — parity is
// a question about codebases, and one codebase (swift) ships two OSes.
export const PLATFORMS = Object.freeze(['swift', 'expo'] as const);
export type Platform = (typeof PLATFORMS)[number];

/** Paths that make a change "client work" and therefore parity-relevant. */
export const PLATFORM_PATHS: Readonly<Record<Platform, string>> = Object.freeze({
  swift: 'apps/swift/',
  expo: 'apps/expo/',
});

/** Human-facing names, used in generated issue titles and error text. */
export const PLATFORM_LABELS: Readonly<Record<Platform, string>> = Object.freeze({
  swift: 'Swift (iOS + macOS)',
  expo: 'Expo (Android)',
});

export function isPlatform(value: string): value is Platform {
  return (PLATFORMS as readonly string[]).includes(value);
}

export function otherPlatform(platform: Platform): Platform {
  return platform === 'swift' ? 'expo' : 'swift';
}

// ── declaration model ──────────────────────────────────────────────────────

export type ParityDirective =
  // Counterpart work is owed on `target`; the workflow opens an issue for it.
  | { kind: 'follow'; target: Platform; note?: string }
  // Both clients were handled in this PR. Nothing owed.
  | { kind: 'done-both' }
  // Parity deliberately does not apply. Requires a reason — an unexplained
  // n/a is indistinguishable from forgetting, which is what this lint exists
  // to catch.
  | { kind: 'n-a'; reason: string };

export interface ParityViolation {
  kind:
    | 'missing-block'
    | 'no-directive'
    | 'bad-platform'
    | 'self-follow'
    | 'missing-reason'
    | 'ambiguous';
  detail: string;
}

export interface ParityResult {
  directive: ParityDirective | null;
  violations: ParityViolation[];
}

export const PARITY_HEADING = '## Parity';

// ── parsing ────────────────────────────────────────────────────────────────

/**
 * Extract the body of the `## Parity` section: everything from the heading up
 * to the next same-or-higher-level heading, or end of body.
 */
export function extractParityBlock(prBody: string): string | null {
  const lines = prBody.split(/\r?\n/);
  const startIdx = lines.findIndex((line) => line.trim().toLowerCase() === '## parity');
  if (startIdx === -1) return null;

  const rest = lines.slice(startIdx + 1);
  const endIdx = rest.findIndex((line) => /^#{1,2}\s/.test(line.trim()));
  const bodyLines = endIdx === -1 ? rest : rest.slice(0, endIdx);
  return bodyLines.join('\n');
}

const LINE_SPLIT_RE = /\r?\n/;
const UNCHECKED_BOX_RE = /^\s*-\s*\[\s*\]/;

/**
 * Remove HTML comments the way a renderer does: a comment runs from `<!--` to
 * the *first* following `-->`, and comments do not nest.
 *
 * Matching the renderer is the whole point — this linter must agree with what
 * a reviewer actually sees on the PR. A single regex pass is not enough,
 * because removing one comment can splice its neighbours into a new `<!--`
 * that was never comment syntax in the source; looping to a fixed point would
 * then delete text GitHub displays. So scan left to right instead.
 */
export function stripHtmlComments(input: string): string {
  let output = '';
  let index = 0;

  while (index < input.length) {
    const open = input.indexOf('<!--', index);
    if (open === -1) {
      output += input.slice(index);
      break;
    }
    output += input.slice(index, open);

    const close = input.indexOf('-->', open + 4);
    // An unterminated `<!--` comments out everything after it when rendered,
    // so drop the remainder rather than parsing text a reader never sees.
    if (close === -1) break;
    index = close + 3;
  }

  return output;
}

/**
 * Strip HTML comments and unchecked-checkbox scaffolding so template
 * boilerplate is never mistaken for a real declaration.
 */
export function stripTemplateNoise(block: string): string {
  return stripHtmlComments(block)
    .split(LINE_SPLIT_RE)
    .filter((line) => !UNCHECKED_BOX_RE.test(line))
    .join('\n');
}

const DIRECTIVE_RE = /^\s*(?:-\s*\[[xX]\]\s*)?(follow|done-both|n\/a|n-a)\s*:?\s*(.*)$/i;

/**
 * Parse the declaration out of a PR body.
 *
 * `landedOn` is the set of platforms the diff actually touches; it's what makes
 * `self-follow` detectable and lets a non-client PR opt out entirely.
 */
export function parseParityDeclaration(prBody: string, landedOn: Platform[]): ParityResult {
  const violations: ParityViolation[] = [];
  const block = extractParityBlock(prBody);

  if (block === null) {
    return {
      directive: null,
      violations: [
        {
          kind: 'missing-block',
          detail:
            `PR body has no "${PARITY_HEADING}" section. This PR touches ` +
            `${landedOn.map((p) => PLATFORM_LABELS[p]).join(' and ')}, so it must declare ` +
            `whether the other client needs the same change.`,
        },
      ],
    };
  }

  const cleaned = stripTemplateNoise(block);
  const found: ParityDirective[] = [];

  for (const rawLine of cleaned.split(/\r?\n/)) {
    const match = rawLine.match(DIRECTIVE_RE);
    if (!match) continue;

    const keyword = (match[1] ?? '').toLowerCase();
    const remainder = (match[2] ?? '').trim();

    if (keyword === 'done-both') {
      found.push({ kind: 'done-both' });
      continue;
    }

    if (keyword === 'n/a' || keyword === 'n-a') {
      if (remainder.length === 0) {
        violations.push({
          kind: 'missing-reason',
          detail:
            '"n/a" must be followed by a reason (e.g. `n/a: macOS-only window ' +
            'management, no Android equivalent`). An unexplained n/a is ' +
            'indistinguishable from forgetting.',
        });
        continue;
      }
      found.push({ kind: 'n-a', reason: remainder });
      continue;
    }

    // keyword === 'follow'
    const [targetToken = '', ...noteParts] = remainder.split(/\s+/);
    const target = targetToken.toLowerCase().replace(/[.,]$/, '');

    if (!isPlatform(target)) {
      violations.push({
        kind: 'bad-platform',
        detail:
          `"follow: ${targetToken || '(nothing)'}" does not name a known platform. ` +
          `Use one of: ${PLATFORMS.join(', ')}.`,
      });
      continue;
    }

    if (landedOn.length === 1 && landedOn[0] === target) {
      violations.push({
        kind: 'self-follow',
        detail:
          `"follow: ${target}" names the platform this PR already changed. ` +
          `Did you mean "follow: ${otherPlatform(target)}"?`,
      });
      continue;
    }

    const note = noteParts.join(' ').trim();
    found.push({ kind: 'follow', target, ...(note ? { note } : {}) });
  }

  if (found.length === 0 && violations.length === 0) {
    violations.push({
      kind: 'no-directive',
      detail:
        `The "${PARITY_HEADING}" section declares nothing. Add exactly one of:\n` +
        '  follow: <swift|expo> [optional note]  — counterpart work is owed\n' +
        '  done-both                             — both clients handled here\n' +
        '  n/a: <reason>                         — parity does not apply',
    });
  }

  if (found.length > 1) {
    violations.push({
      kind: 'ambiguous',
      detail: `Declared ${found.length} directives; exactly one is allowed.`,
    });
  }

  return { directive: violations.length === 0 ? (found[0] ?? null) : null, violations };
}

// ── diff classification ────────────────────────────────────────────────────

/** Which clients a set of changed files touches. */
export function platformsTouched(changedFiles: string[]): Platform[] {
  return PLATFORMS.filter((platform) =>
    changedFiles.some((file) => file.startsWith(PLATFORM_PATHS[platform])),
  );
}

// ── CLI ────────────────────────────────────────────────────────────────────

function readChangedFiles(path: string): string[] {
  return readFileSync(path, 'utf-8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function main(): void {
  const args = process.argv.slice(2);
  const bodyPath = args[args.indexOf('--body') + 1];
  const filesPath = args[args.indexOf('--changed-files') + 1];

  if (!args.includes('--body') || !bodyPath || !args.includes('--changed-files') || !filesPath) {
    console.error(
      'usage: check-parity-declaration.ts --body <pr-body.txt> --changed-files <files.txt>',
    );
    process.exit(2);
  }

  const prBody = readFileSync(bodyPath, 'utf-8');
  const changedFiles = readChangedFiles(filesPath);
  const landedOn = platformsTouched(changedFiles);

  if (landedOn.length === 0) {
    console.log('✅ parity: PR touches no client code — declaration not required.');
    process.exit(0);
  }

  const { directive, violations } = parseParityDeclaration(prBody, landedOn);

  if (violations.length > 0) {
    console.error(`\n❌ parity declaration invalid (${violations.length} problem(s)):\n`);
    for (const violation of violations) {
      console.error(`  [${violation.kind}] ${violation.detail}\n`);
    }
    console.error('See docs/parity.md for the declaration format.\n');
    process.exit(1);
  }

  const touched = landedOn.map((p) => PLATFORM_LABELS[p]).join(' + ');
  switch (directive?.kind) {
    case 'follow':
      console.log(
        `✅ parity: landed on ${touched} — follow-up owed on ` +
          `${PLATFORM_LABELS[directive.target]}. An issue will be opened on merge.`,
      );
      break;
    case 'done-both':
      console.log(`✅ parity: both clients handled in this PR (${touched}).`);
      break;
    case 'n-a':
      console.log(`✅ parity: not applicable — ${directive.reason}`);
      break;
  }
  process.exit(0);
}

if (import.meta.main) {
  main();
}
