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
export const REGISTRY_HEADING = '## Override registry';

export interface RegistryEntry {
  reason?: string;
  removeWhen?: string;
}
export type Registry = Record<string, RegistryEntry>;

function readJson(filePath: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export interface OverrideViolation {
  kind: 'missing-entry' | 'incomplete-entry' | 'stale-entry';
  pkg: string;
  detail: string;
}

// ── registry extraction ────────────────────────────────────────────────────

// Extract the first ```json fenced block that follows the registry heading.
// Tolerates LF and CRLF line endings around the fence.
export function extractRegistryBlock(markdown: string): string | null {
  const headingIdx = markdown.indexOf(REGISTRY_HEADING);
  if (headingIdx === -1) return null;
  const after = markdown.slice(headingIdx);
  const match = after.match(/```json\s*\r?\n([\s\S]*?)\r?\n```/);
  return match?.[1] ?? null;
}

export function parseRegistry(markdown: string): Registry | null {
  const block = extractRegistryBlock(markdown);
  if (block === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(block);
  } catch {
    return null;
  }
  if (!isObject(parsed)) return null;
  // Validate each entry is an object so the Registry shape is honest rather
  // than asserted — a value like `{"react": 42}` is a malformed registry.
  const registry: Registry = {};
  for (const [pkg, value] of Object.entries(parsed)) {
    if (!isObject(value)) return null;
    registry[pkg] = {
      reason: typeof value.reason === 'string' ? value.reason : undefined,
      removeWhen: typeof value.removeWhen === 'string' ? value.removeWhen : undefined,
    };
  }
  return registry;
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
  const rootPkg = readJson(join(ROOT, 'package.json'));
  if (rootPkg === null) {
    console.error('check:overrides — root package.json could not be read or parsed.');
    process.exit(1);
  }
  const overrides = isObject(rootPkg.overrides) ? rootPkg.overrides : {};

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
