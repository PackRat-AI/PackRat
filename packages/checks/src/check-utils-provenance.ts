#!/usr/bin/env bun
/**
 * check-utils-provenance.ts — validates the @packrat/utils provenance manifest
 * (packages/utils/src/provenance.ts) against the actual barrel exports
 * (packages/utils/src/index.ts) and enforces the source-priority policy.
 *
 * The manifest is the source-of-truth for where each curated util comes from.
 * This check is the CI-enforced version of packages/utils/src/provenance.test.ts:
 * it asserts the manifest and the barrel never drift apart, and that every
 * lower-priority source pick is justified.
 *
 * Invariants (a violation of any fails the run):
 *   - MISSING:      every barrel export has exactly one manifest entry;
 *   - STALE:        every manifest key maps to a real barrel export;
 *   - UNKNOWN:      every `source` is a known lib (LIB_PRIORITY ∪ unranked);
 *   - UNJUSTIFIED:  if any lib in an entry's `alsoIn` outranks its `source`
 *                   in LIB_PRIORITY, a non-empty `reason` is required.
 *
 * Priority is a soft default — `reason` is how a deliberate lower-priority pick
 * is recorded and kept honest. See docs/utils-policy.md.
 *
 * Run:         bun ./src/check-utils-provenance.ts
 * Strict mode: bun ./src/check-utils-provenance.ts --strict
 *
 * Both modes exit 1 on any violation (the manifest must always be in sync);
 * `--strict` exists only to mirror the sibling checks' flag convention.
 */

import * as barrel from '@packrat/utils';
import {
  LIB_PRIORITY,
  type ProvenanceEntry,
  provenance,
  type RankedLib,
} from '@packrat/utils/provenance';

const KNOWN_SOURCES = new Set<string>([...LIB_PRIORITY, 'destr', 'safe-stable-stringify']);

const rankOf = (lib: string): number => LIB_PRIORITY.indexOf(lib as RankedLib);
const isRanked = (lib: string): boolean => rankOf(lib) !== -1;

export interface ProvenanceViolation {
  kind: 'missing' | 'stale' | 'unknown' | 'unjustified';
  name: string;
  detail: string;
}

/**
 * Pure validator — feeds the real barrel/manifest in production and synthetic
 * fixtures in tests. Returns one violation per problem found (empty = valid).
 */
export function validateProvenance({
  exportedNames,
  manifest,
}: {
  exportedNames: string[];
  manifest: Record<string, ProvenanceEntry>;
}): ProvenanceViolation[] {
  const violations: ProvenanceViolation[] = [];
  const exportSet = new Set(exportedNames);
  const manifestNames = Object.keys(manifest);

  // a. Every barrel export has a manifest entry.
  for (const name of exportedNames) {
    if (!(name in manifest)) {
      violations.push({
        kind: 'missing',
        name,
        detail: `barrel export "${name}" has no manifest entry`,
      });
    }
  }

  // b. No stale manifest entries.
  for (const name of manifestNames) {
    if (!exportSet.has(name)) {
      violations.push({
        kind: 'stale',
        name,
        detail: `manifest entry "${name}" is not a barrel export`,
      });
    }
  }

  for (const [name, entry] of Object.entries(manifest)) {
    // c. Known source.
    if (!KNOWN_SOURCES.has(entry.source)) {
      violations.push({
        kind: 'unknown',
        name,
        detail: `source "${entry.source}" is not a known lib`,
      });
    }

    // d. Lower-priority source requires a reason.
    if (isRanked(entry.source) && entry.alsoIn) {
      const outranked = entry.alsoIn.some(
        (alt) => isRanked(alt) && rankOf(alt) < rankOf(entry.source),
      );
      if (outranked && !entry.reason?.trim()) {
        violations.push({
          kind: 'unjustified',
          name,
          detail: `source "${entry.source}" is outranked by a lib in alsoIn (${entry.alsoIn.join(
            ', ',
          )}) but no reason is given`,
        });
      }
    }
  }

  return violations;
}

function report(violations: ProvenanceViolation[]): void {
  if (violations.length === 0) {
    const count = Object.keys(provenance).length;
    console.log(
      `✓ @packrat/utils provenance manifest in sync (${count} exports = ${count} entries).`,
    );
    return;
  }

  console.log(`Found ${violations.length} provenance violation(s) in @packrat/utils:\n`);

  const labels: Record<ProvenanceViolation['kind'], string> = {
    missing: 'Missing manifest entry',
    stale: 'Stale manifest entry',
    unknown: 'Unknown source lib',
    unjustified: 'Unjustified lower-priority source (missing reason)',
  };

  for (const v of violations) {
    console.log(`  [${labels[v.kind]}] ${v.detail}`);
  }

  console.log('\nFix packages/utils/src/provenance.ts so it matches the barrel exports.');
  console.log('See docs/utils-policy.md for the source-priority policy.');
}

if (import.meta.main) {
  const violations = validateProvenance({
    exportedNames: Object.keys(barrel),
    manifest: provenance,
  });
  report(violations);
  // Both modes fail on any violation; --strict mirrors the sibling checks' flag.
  process.exit(violations.length === 0 ? 0 : 1);
}
