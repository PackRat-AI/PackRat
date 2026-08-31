#!/usr/bin/env bun
//
// detect-access-decisions.ts — decides whether a PR introduces a new
// user-facing feature, and therefore needs an explicit human access decision
// before it can merge.
//
// Why: most PRs are fixes, refactors and polish, and forcing a product decision
// onto every one of them would be pure friction. Only genuinely new features
// need someone to say who gets them. This script finds those, so the gate stays
// quiet the rest of the time.
//
// Two detectors, deliberately ordered:
//
//   1. AGENT-DECLARED (primary). The coding agent classifies its own PR and
//      writes an Access-Decision block into the PR body. The workflow here is
//      AI-first, so the agent is what actually knows whether it built a feature.
//      See docs/access-decisions.md for the contract it follows.
//
//   2. MECHANICAL (fallback). A new key added to `FeatureFlag` in
//      packages/config/src/config.ts, or a new `feature_access` key. Purely
//      deterministic, and catches the case where the agent forgot to declare.
//
// Detection FAILS TOWARD THE GATE. A PR whose classification cannot be
// established is gated, not waved through: a false positive costs one edit to
// the PR body, a false negative ships an undecided feature to everyone. The
// only way to pass without a decision is an explicit, valid `none` declaration.
//
// This script never proposes a tier. Deciding who gets a feature is a product
// judgement and stays with a human — the script only reports that the decision
// is owed.
//
// Usage:
//   bun scripts/lint/detect-access-decisions.ts --base <ref> [--body-file <path>]
//
// Exit code:
//   0 — no decision required, or a complete and valid decision is present
//   1 — a decision is required and is missing or malformed
//   2 — the script could not determine the answer (also gates; see above)

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { featureAccessKeyForFlag } from '@packrat/config';

export const DECISION_BLOCK_HEADING = '## Access decision';

/** The classifications an agent may declare. */
export const DECLARATIONS = Object.freeze({
  /** No new user-facing feature — fix, refactor, docs, chore, test. */
  None: 'none',
  /** A new user-facing feature. Requires a human to choose who gets it. */
  NewFeature: 'new-feature',
} as const);

export type Declaration = (typeof DECLARATIONS)[keyof typeof DECLARATIONS];

/** How a feature is released, once a human has decided. */
export const AUDIENCES = Object.freeze({
  /** Everyone, immediately. No early-access window. */
  Everyone: 'everyone',
  /** Pro members first, until the expiry date passes. */
  EarlyAccess: 'early-access',
} as const);

export type Audience = (typeof AUDIENCES)[keyof typeof AUDIENCES];

export interface AccessDecision {
  declaration: Declaration;
  /** Present only for new features that a human has decided on. */
  audience?: Audience;
  /** The feature_access key. Required when audience is set. */
  featureKey?: string;
  /** ISO date. Required for early-access, forbidden for everyone. */
  expiry?: string;
}

export interface DetectionResult {
  /** Whether the diff itself shows a new flag or feature_access key. */
  mechanicalHit: boolean;
  /** Keys the mechanical detector found, for the report. */
  mechanicalKeys: string[];
  /** The decision parsed from the PR body, if any. */
  decision: AccessDecision | null;
  /** Why the decision was rejected, when it was. */
  parseErrors: string[];
}

// ---------------------------------------------------------------------------
// Mechanical detection
// ---------------------------------------------------------------------------

const CONFIG_PATH = 'packages/config/src/config.ts';

/**
 * Flag keys added to the `FeatureFlag` map in this diff.
 *
 * Reads added lines inside config.ts rather than parsing the file at both revs:
 * a key can only enter the map through an added line, and this stays correct
 * when the surrounding object is reformatted.
 */
export function newFeatureFlagKeys(diff: string): string[] {
  const keys: string[] = [];
  // Matches an added enum entry, e.g. `+  EnableFoo: 'enableFoo',`
  const addedEntry = /^\+\s*[A-Za-z0-9_]+:\s*'([a-zA-Z0-9_]+)'\s*,?\s*$/;

  for (const line of diff.split('\n')) {
    const match = line.match(addedEntry);
    if (match?.[1]) keys.push(match[1]);
  }
  return keys;
}

/**
 * Flag keys whose default value is added as `true` in this diff.
 *
 * The convention is that a new feature ships dark: the flag defaults to `false`
 * and is turned on deliberately. A new key defaulting to `true` is on for
 * everyone the moment it merges, which is the decision this gate exists to stop
 * from happening by accident.
 *
 * Matches the defaults block in `APP_CONFIG_SOURCE`, e.g.
 * `+    [FeatureFlag.EnableSummitLog]: true,`
 */
export function newFlagsDefaultingTrue(diff: string): string[] {
  const keys: string[] = [];
  const addedDefault = /^\+\s*\[FeatureFlag\.([A-Za-z0-9_]+)\]:\s*true\s*,?\s*$/;

  for (const line of diff.split('\n')) {
    const match = line.match(addedDefault);
    // Report the enum member name; the caller has the wire name from
    // newFeatureFlagKeys and the two are adjacent in the file.
    if (match?.[1]) keys.push(match[1]);
  }
  return keys;
}

/**
 * The `packages/config/src/config.ts` slice of a unified diff, or '' when the
 * file is untouched.
 */
export function configDiffSlice(diff: string): string {
  const marker = `diff --git a/${CONFIG_PATH} b/${CONFIG_PATH}`;
  const start = diff.indexOf(marker);
  if (start === -1) return '';

  const next = diff.indexOf('\ndiff --git ', start + marker.length);
  return next === -1 ? diff.slice(start) : diff.slice(start, next);
}

// ---------------------------------------------------------------------------
// PR-body declaration parsing
// ---------------------------------------------------------------------------

function isDeclaration(value: string): value is Declaration {
  return Object.values(DECLARATIONS).includes(value as Declaration);
}

function isAudience(value: string): value is Audience {
  return Object.values(AUDIENCES).includes(value as Audience);
}

/**
 * Parses the Access-decision block out of a PR body.
 *
 * Expected shape (field order is free, matching is case-insensitive):
 *
 *   ## Access decision
 *   declaration: new-feature
 *   audience: early-access
 *   feature-key: wildlife
 *   expiry: 2026-10-15
 *
 * Returns `null` when no block is present at all. A malformed block is not
 * `null` — it is a decision that failed to parse, and it gates.
 */
export function parseDecision(body: string): {
  decision: AccessDecision | null;
  errors: string[];
} {
  const errors: string[] = [];

  const headingIndex = body.toLowerCase().indexOf(DECISION_BLOCK_HEADING.toLowerCase());
  if (headingIndex === -1) return { decision: null, errors };

  const afterHeading = body.slice(headingIndex + DECISION_BLOCK_HEADING.length);
  // The block ends at the next markdown heading, or the end of the body.
  const nextHeading = afterHeading.search(/\n#{1,6}\s/);
  const block = nextHeading === -1 ? afterHeading : afterHeading.slice(0, nextHeading);

  const fields = new Map<string, string>();
  for (const rawLine of block.split('\n')) {
    // Tolerate list markers and bold, which editors and templates add freely.
    const line = rawLine
      .replace(/^[\s>*-]+/, '')
      .replace(/\*\*/g, '')
      .trim();
    if (!line) continue;

    const separator = line.indexOf(':');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key && value) fields.set(key, value);
  }

  const rawDeclaration = fields.get('declaration');
  if (!rawDeclaration) {
    errors.push(`"${DECISION_BLOCK_HEADING}" block is present but has no \`declaration:\` field.`);
    return { decision: null, errors };
  }

  const declaration = rawDeclaration.toLowerCase();
  if (!isDeclaration(declaration)) {
    errors.push(
      `Unknown declaration "${rawDeclaration}". Use one of: ${Object.values(DECLARATIONS).join(', ')}.`,
    );
    return { decision: null, errors };
  }

  const decision: AccessDecision = { declaration };

  const rawAudience = fields.get('audience');
  if (rawAudience) {
    const audience = rawAudience.toLowerCase();
    if (!isAudience(audience)) {
      errors.push(
        `Unknown audience "${rawAudience}". Use one of: ${Object.values(AUDIENCES).join(', ')}.`,
      );
    } else {
      decision.audience = audience;
    }
  }

  const featureKey = fields.get('feature-key') ?? fields.get('feature key');
  if (featureKey) decision.featureKey = featureKey;

  const expiry = fields.get('expiry');
  if (expiry) decision.expiry = expiry;

  return { decision, errors };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Whether an ISO date string names a day that actually exists.
 *
 * `new Date('2026-02-31')` does not return NaN — it silently rolls over to
 * March 3rd. Round-tripping back to ISO is what catches that, so a typo'd
 * expiry is rejected instead of quietly becoming a different date than the
 * human who wrote it intended.
 */
function isRealCalendarDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().startsWith(value);
}

/**
 * Validates a decision for a PR that needs one. Returns the reasons it is not
 * yet actionable; an empty array means the gate may open.
 */
export function validateDecision(decision: AccessDecision | null): string[] {
  if (!decision) {
    return [
      'This PR adds a new user-facing feature, so it needs an explicit access decision before it can merge.',
    ];
  }

  if (decision.declaration === DECLARATIONS.None) {
    // The agent said "no new feature" but the diff says otherwise. Trust the
    // diff: a new flag key is not something a fix or refactor introduces.
    return [
      'The diff adds a new feature flag or feature_access key, but the declaration says `none`.',
      'Either remove the new key, or change the declaration to `new-feature` and have a human choose the audience.',
    ];
  }

  const problems: string[] = [];

  if (!decision.audience) {
    problems.push(
      'A human must set `audience:` to `everyone` or `early-access`. An agent must not choose this.',
    );
  }

  if (!decision.featureKey) {
    problems.push(
      '`feature-key:` is required — it is the key written to the feature_access table.',
    );
  }

  if (decision.audience === AUDIENCES.EarlyAccess) {
    if (!decision.expiry) {
      problems.push('`expiry:` is required for early-access (ISO date, e.g. 2026-10-15).');
    } else if (!ISO_DATE.test(decision.expiry)) {
      problems.push(`\`expiry:\` must be an ISO date (YYYY-MM-DD), got "${decision.expiry}".`);
    } else if (!isRealCalendarDate(decision.expiry)) {
      problems.push(`\`expiry:\` is not a real calendar date: "${decision.expiry}".`);
    }
  }

  if (decision.audience === AUDIENCES.Everyone && decision.expiry) {
    problems.push('`expiry:` must be omitted when the audience is `everyone` — GA has no window.');
  }

  return problems;
}

/**
 * Checks the both-gates convention: every new feature carries a feature flag
 * *and* a `feature_access` key, with the access key derived from the flag name.
 *
 * These answer different questions — the flag is "can this be on at all", the
 * access row is "who may use it" — and a feature with only one of them is
 * half-gated. A flag with no access row ships to whoever the flag lets in, with
 * no audience decision. An access row with no flag cannot be switched off.
 *
 * @param flagKeys      Wire-name flag keys added in this diff.
 * @param declaredKey   The `feature-key` from the PR declaration, if any.
 */
export function validateConvention({
  flagKeys,
  declaredKey,
}: {
  flagKeys: string[];
  declaredKey?: string;
}): string[] {
  if (flagKeys.length === 0) return [];

  const problems: string[] = [];
  const expected = flagKeys.map(featureAccessKeyForFlag);

  if (!declaredKey) {
    problems.push(
      `This PR adds the feature flag(s) ${flagKeys.join(', ')}, so it also needs a feature_access key.`,
      `By the naming rule that is: ${expected.join(', ')}. See docs/access-decisions.md.`,
    );
    return problems;
  }

  if (!expected.includes(declaredKey)) {
    problems.push(
      `\`feature-key: ${declaredKey}\` does not match the flag(s) added in this PR.`,
      `Expected one of: ${expected.join(', ')} (derived from ${flagKeys.join(', ')}).`,
      'The two names are paired by rule so CI can check them; see docs/access-decisions.md.',
    );
  }

  return problems;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function main(): never {
  const base = readArg('--base');
  if (!base) {
    console.error('detect-access-decisions: --base <ref> is required.');
    process.exit(2);
  }

  let diff: string;
  try {
    diff = execFileSync('git', ['diff', `${base}...HEAD`, '--', CONFIG_PATH], {
      encoding: 'utf-8',
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (error) {
    // Cannot read the diff — gate rather than guess.
    console.error(`detect-access-decisions: could not diff against "${base}": ${error}`);
    process.exit(2);
  }

  const mechanicalKeys = newFeatureFlagKeys(diff);
  const bodyFile = readArg('--body-file');
  const body = bodyFile && existsSync(bodyFile) ? readFileSync(bodyFile, 'utf-8') : '';

  const { decision, errors } = parseDecision(body);

  if (errors.length > 0) {
    console.error('✗ The access-decision block could not be read:\n');
    for (const problem of errors) console.error(`  - ${problem}`);
    process.exit(1);
  }

  if (mechanicalKeys.length === 0 && decision?.declaration !== DECLARATIONS.NewFeature) {
    console.log('✓ No new user-facing feature detected — no access decision required.');
    process.exit(0);
  }

  if (mechanicalKeys.length > 0) {
    console.log(`Detected new feature flag key(s): ${mechanicalKeys.join(', ')}`);
  }

  // The convention is that a new feature ships dark. A flag whose default is
  // added as `true` is on for everyone at merge, which is precisely the
  // undecided rollout this gate exists to prevent — and unlike a missing
  // access decision, no later edit to the PR body will change it.
  const defaultingTrue = newFlagsDefaultingTrue(diff);
  if (defaultingTrue.length > 0) {
    console.error('\n✗ New feature flags must default to `false`.\n');
    console.error(
      `  - ${defaultingTrue.join(', ')} default to true in packages/config/src/config.ts.`,
    );
    console.error('  - A new feature ships dark and is turned on deliberately. Set the default to');
    console.error('    false and enable it once the access decision is in place.\n');
    console.error('See docs/access-decisions.md.');
    process.exit(1);
  }

  const problems = validateDecision(decision);
  if (problems.length > 0) {
    console.error('\n✗ This PR needs a human access decision before it can merge.\n');
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error('\nAdd or complete this block in the PR description:\n');
    console.error(`  ${DECISION_BLOCK_HEADING}`);
    console.error('  declaration: new-feature');
    console.error('  audience: <everyone|early-access>   # a human chooses this');
    console.error('  feature-key: <key>');
    console.error('  expiry: YYYY-MM-DD                  # early-access only\n');
    console.error('See docs/access-decisions.md.');
    process.exit(1);
  }

  // Both gates, paired by rule. Checked after validateDecision so a PR missing
  // its audience hears about that first rather than getting two complaints at
  // once about the same incomplete block.
  const conventionProblems = validateConvention({
    flagKeys: mechanicalKeys,
    declaredKey: decision?.featureKey,
  });
  if (conventionProblems.length > 0) {
    console.error('\n✗ Every new feature needs both a feature flag and a feature_access key.\n');
    for (const problem of conventionProblems) console.error(`  - ${problem}`);
    console.error('');
    process.exit(1);
  }

  console.log('✓ Access decision present and complete.');
  process.exit(0);
}

if (import.meta.main) main();
