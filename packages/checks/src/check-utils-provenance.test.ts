import * as barrel from '@packrat/utils';
import { type ProvenanceEntry, provenance } from '@packrat/utils/provenance';
import { describe, expect, it } from 'vitest';
import { type ProvenanceViolation, validateProvenance } from './check-utils-provenance';

/**
 * A minimal valid manifest: barrel exports == manifest keys, every source
 * known, no unjustified lower-priority pick. Each failure-mode test mutates
 * a copy of this so the only variable is the invariant under test.
 */
const baseManifest: Record<string, ProvenanceEntry> = {
  unique: { source: 'radashi' },
  chunk: { source: 'es-toolkit' },
  safeParse: { source: 'destr' },
  round: {
    source: 'es-toolkit',
    alsoIn: ['radashi'],
    reason: 'es-toolkit round supports precision; radashi round does not',
  },
};

const baseExports = Object.keys(baseManifest);

const kinds = (violations: ProvenanceViolation[]): ProvenanceViolation['kind'][] =>
  violations.map((v) => v.kind);

describe('validateProvenance', () => {
  it('returns no violations when exports and manifest are in sync and valid', () => {
    const violations = validateProvenance({ exportedNames: baseExports, manifest: baseManifest });
    expect(violations).toEqual([]);
  });

  it('flags a barrel export with no manifest entry as MISSING', () => {
    const violations = validateProvenance({
      exportedNames: [...baseExports, 'orphanExport'],
      manifest: baseManifest,
    });
    expect(kinds(violations)).toEqual(['missing']);
    expect(violations[0]?.name).toBe('orphanExport');
    expect(violations[0]?.detail).toContain('orphanExport');
  });

  it('flags a manifest entry with no matching export as STALE', () => {
    const violations = validateProvenance({
      exportedNames: baseExports,
      manifest: { ...baseManifest, ghost: { source: 'radashi' } },
    });
    expect(kinds(violations)).toEqual(['stale']);
    expect(violations[0]?.name).toBe('ghost');
    expect(violations[0]?.detail).toContain('ghost');
  });

  it('flags an entry whose source is not a known lib as UNKNOWN', () => {
    const violations = validateProvenance({
      exportedNames: [...baseExports, 'weird'],
      // 'underscore' is not a SourceLib — forge an invalid source via unknown.
      manifest: { ...baseManifest, weird: { source: 'underscore' as unknown as 'radashi' } },
    });
    expect(kinds(violations)).toEqual(['unknown']);
    expect(violations[0]?.name).toBe('weird');
    expect(violations[0]?.detail).toContain('underscore');
  });

  it('flags a lower-priority source without a reason as UNJUSTIFIED', () => {
    const violations = validateProvenance({
      exportedNames: [...baseExports, 'roundNoReason'],
      manifest: {
        ...baseManifest,
        // es-toolkit is outranked by radashi in alsoIn, but no reason given.
        roundNoReason: { source: 'es-toolkit', alsoIn: ['radashi'] },
      },
    });
    expect(kinds(violations)).toEqual(['unjustified']);
    expect(violations[0]?.name).toBe('roundNoReason');
    expect(violations[0]?.detail).toContain('es-toolkit');
  });

  it('treats a whitespace-only reason as no reason (UNJUSTIFIED)', () => {
    const violations = validateProvenance({
      exportedNames: [...baseExports, 'roundBlank'],
      manifest: {
        ...baseManifest,
        roundBlank: { source: 'es-toolkit', alsoIn: ['radashi'], reason: '   ' },
      },
    });
    expect(kinds(violations)).toEqual(['unjustified']);
    expect(violations[0]?.name).toBe('roundBlank');
  });

  it('does not flag a higher-or-equal-priority source listed in alsoIn', () => {
    const violations = validateProvenance({
      exportedNames: [...baseExports, 'higherPick'],
      manifest: {
        ...baseManifest,
        // radashi outranks es-toolkit, so listing es-toolkit in alsoIn needs no reason.
        higherPick: { source: 'radashi', alsoIn: ['es-toolkit'] },
      },
    });
    expect(violations).toEqual([]);
  });

  it('reports every distinct failure mode at once', () => {
    const violations = validateProvenance({
      exportedNames: [...baseExports, 'orphanExport'],
      manifest: {
        ...baseManifest,
        ghost: { source: 'radashi' },
        weird: { source: 'underscore' as unknown as 'radashi' },
        roundNoReason: { source: 'es-toolkit', alsoIn: ['radashi'] },
      },
    });
    // weird and roundNoReason have no export, so they are also STALE.
    expect(kinds(violations).sort()).toEqual(
      ['missing', 'stale', 'stale', 'stale', 'unjustified', 'unknown'].sort(),
    );
    expect(violations.length).toBe(6);
  });
});

describe('real @packrat/utils manifest', () => {
  it('is in sync with the barrel and passes every invariant', () => {
    const violations = validateProvenance({
      exportedNames: Object.keys(barrel),
      manifest: provenance,
    });
    expect(violations).toEqual([]);
  });

  it('has exactly as many manifest entries as barrel exports', () => {
    expect(Object.keys(provenance).length).toBe(Object.keys(barrel).length);
  });
});
