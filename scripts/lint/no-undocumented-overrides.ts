#!/usr/bin/env bun
//
// no-undocumented-overrides.ts — ensures every root package.json `overrides`
// entry is justified in the override registry in docs/dependency-policy.md,
// and that the registry has no stale entries.
//
// Why: package.json is strict JSON and cannot carry rationale comments, so an
// override's reason + removal condition live in the policy doc's fenced JSON
// registry block. This lint keeps the two in sync — see docs/dependency-policy.md.
//
// What gets flagged:
//   - MISSING ENTRY:    a root override with no registry entry
//   - INCOMPLETE ENTRY: a registry entry missing a non-empty reason/removeWhen
//   - STALE ENTRY:      a registry entry that no longer matches any override
//   - BAD REGISTRY:     the fenced JSON block is missing or not valid JSON
//
// Exit code:
//   0 — overrides and registry agree
//   1 — any violation above

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..');
const POLICY_DOC = join(ROOT, 'docs', 'dependency-policy.md');
const REGISTRY_HEADING = '## Override registry';

export interface RegistryEntry {
  reason?: unknown;
  removeWhen?: unknown;
}
export type Registry = Record<string, RegistryEntry>;

export interface OverrideViolation {
  kind: 'missing-entry' | 'incomplete-entry' | 'stale-entry';
  pkg: string;
  detail: string;
}

// ── registry extraction ────────────────────────────────────────────────────

// Extract the first ```json fenced block that follows the registry heading.
export function extractRegistryBlock(markdown: string): string | null {
  const headingIdx = markdown.indexOf(REGISTRY_HEADING);
  if (headingIdx === -1) return null;
  const after = markdown.slice(headingIdx);
  const match = after.match(/```json\s*\n([\s\S]*?)\n```/);
  return match ? match[1] : null;
}

export function parseRegistry(markdown: string): Registry | null {
  const block = extractRegistryBlock(markdown);
  if (block === null) return null;
  try {
    const parsed = JSON.parse(block);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Registry;
    }
    return null;
  } catch {
    return null;
  }
}

// ── analysis (pure) ─────────────────────────────────────────────────────────

const isNonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

export function findViolations(
  overrides: Record<string, unknown>,
  registry: Registry,
): OverrideViolation[] {
  const violations: OverrideViolation[] = [];

  for (const pkg of Object.keys(overrides)) {
    const entry = registry[pkg];
    if (!entry) {
      violations.push({
        kind: 'missing-entry',
        pkg,
        detail: `override "${pkg}" has no registry entry in docs/dependency-policy.md`,
      });
      continue;
    }
    if (!isNonEmpty(entry.reason) || !isNonEmpty(entry.removeWhen)) {
      violations.push({
        kind: 'incomplete-entry',
        pkg,
        detail: `registry entry for "${pkg}" needs a non-empty "reason" and "removeWhen"`,
      });
    }
  }

  for (const pkg of Object.keys(registry)) {
    if (!(pkg in overrides)) {
      violations.push({
        kind: 'stale-entry',
        pkg,
        detail: `registry entry "${pkg}" matches no root override (stale — remove it)`,
      });
    }
  }

  return violations;
}

// ── CLI ───────────────────────────────────────────────────────────────────

function main(): void {
  const rootPkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')) as {
    overrides?: Record<string, unknown>;
  };
  const overrides =
    rootPkg.overrides && typeof rootPkg.overrides === 'object' ? rootPkg.overrides : {};

  let markdown: string;
  try {
    markdown = readFileSync(POLICY_DOC, 'utf-8');
  } catch {
    console.error(
      'check:overrides — docs/dependency-policy.md not found. The override registry must live there.',
    );
    process.exit(1);
  }

  const registry = parseRegistry(markdown);
  if (registry === null) {
    console.error(
      'check:overrides — could not find or parse the ```json override registry block under ' +
        `"${REGISTRY_HEADING}" in docs/dependency-policy.md.`,
    );
    process.exit(1);
  }

  const violations = findViolations(overrides, registry);
  if (violations.length === 0) {
    console.log(`check:overrides — OK (${Object.keys(overrides).length} override(s) documented).`);
    process.exit(0);
  }

  console.error('check:overrides — the override registry is out of sync with root overrides:\n');
  for (const v of violations) {
    console.error(`  ✗ ${v.detail}`);
  }
  console.error(
    '\nEvery root override needs a registry entry (reason + removeWhen) in docs/dependency-policy.md.',
  );
  process.exit(1);
}

if (import.meta.main) {
  main();
}
