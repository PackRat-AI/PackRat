import { describe, expect, it } from 'vitest';
import * as barrel from './index';
import { LIB_PRIORITY, provenance, type RankedLib } from './provenance';

const exportedNames = Object.keys(barrel).sort();
const manifestNames = Object.keys(provenance).sort();

const rankOf = (lib: string): number => LIB_PRIORITY.indexOf(lib as RankedLib);
const isRanked = (lib: string): boolean => rankOf(lib) !== -1;

describe('provenance manifest', () => {
  it('has an entry for every barrel export', () => {
    const missing = exportedNames.filter((name) => !manifestNames.includes(name));
    expect(missing).toEqual([]);
  });

  it('has no stale entries (every entry maps to a real export)', () => {
    const stale = manifestNames.filter((name) => !exportedNames.includes(name));
    expect(stale).toEqual([]);
  });

  it('sources every export from a known lib', () => {
    const known = new Set<string>([...LIB_PRIORITY, 'destr', 'safe-stable-stringify']);
    const unknown = Object.entries(provenance)
      .filter(([, entry]) => !known.has(entry.source))
      .map(([name]) => name);
    expect(unknown).toEqual([]);
  });

  it('requires a reason when a lower-priority lib is chosen over a higher-priority one', () => {
    const unjustified = Object.entries(provenance)
      .filter(([, entry]) => {
        if (!isRanked(entry.source) || !entry.alsoIn) return false;
        const outranked = entry.alsoIn.some(
          (alt) => isRanked(alt) && rankOf(alt) < rankOf(entry.source),
        );
        return outranked && !entry.reason?.trim();
      })
      .map(([name]) => name);
    expect(unjustified).toEqual([]);
  });

  it('documents round as a justified lower-priority (es-toolkit over radashi) pick', () => {
    const round = provenance.round;
    expect(round?.source).toBe('es-toolkit');
    expect(round?.alsoIn).toContain('radashi');
    expect(round?.reason?.length ?? 0).toBeGreaterThan(0);
  });
});
