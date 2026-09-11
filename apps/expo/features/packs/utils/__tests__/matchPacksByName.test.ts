import { describe, expect, it } from 'vitest';
import { matchPacksByName, type PackNameCandidate } from '../matchPacksByName';

function pack(overrides: Partial<PackNameCandidate> & { id: string; name: string }) {
  return {
    description: null,
    category: 'hiking',
    isPublic: false,
    tags: null,
    deleted: false,
    ...overrides,
  } satisfies PackNameCandidate;
}

const japanTrip = pack({ id: 'p1', name: 'Japan Trip', category: 'travel' });
const skiWeekend = pack({ id: 'p2', name: 'Ski Weekend', category: 'skiing' });
const deleted = pack({ id: 'p3', name: 'Old Japan Trip', deleted: true });

describe('matchPacksByName', () => {
  // The exact scenario from issue #2710: the pack is on screen, the user names
  // it exactly, and the assistant claimed it did not exist.
  it('finds a pack by its exact name', () => {
    const result = matchPacksByName({ packs: [japanTrip, skiWeekend], nameQuery: 'Japan Trip' });

    expect(result).toEqual([
      {
        id: 'p1',
        name: 'Japan Trip',
        description: null,
        category: 'travel',
        isPublic: false,
        tags: null,
      },
    ]);
  });

  it('matches case-insensitively', () => {
    for (const query of ['japan trip', 'JAPAN TRIP', 'jApAn TrIp']) {
      const result = matchPacksByName({ packs: [japanTrip, skiWeekend], nameQuery: query });
      expect(result.map((p) => p.id)).toEqual(['p1']);
    }
  });

  it('ignores surrounding whitespace in the query', () => {
    const result = matchPacksByName({
      packs: [japanTrip, skiWeekend],
      nameQuery: '   Japan Trip \n ',
    });

    expect(result.map((p) => p.id)).toEqual(['p1']);
  });

  it('collapses internal whitespace runs on both sides', () => {
    const doubleSpaced = pack({ id: 'p4', name: 'Japan   Trip' });

    expect(matchPacksByName({ packs: [doubleSpaced], nameQuery: 'Japan Trip' })).toHaveLength(1);
    expect(matchPacksByName({ packs: [japanTrip], nameQuery: 'Japan   Trip' })).toHaveLength(1);
  });

  it('matches on a partial name so "japan" finds "Japan Trip"', () => {
    const result = matchPacksByName({ packs: [japanTrip, skiWeekend], nameQuery: 'japan' });
    expect(result.map((p) => p.id)).toEqual(['p1']);
  });

  it('matches a substring that is not a prefix', () => {
    const result = matchPacksByName({ packs: [japanTrip, skiWeekend], nameQuery: 'trip' });
    expect(result.map((p) => p.id)).toEqual(['p1']);
  });

  it('ranks exact over prefix over substring', () => {
    const exact = pack({ id: 'exact', name: 'Japan' });
    const prefix = pack({ id: 'prefix', name: 'Japan Trip' });
    const substring = pack({ id: 'substring', name: 'Trip to Japan' });

    const result = matchPacksByName({
      packs: [substring, prefix, exact],
      nameQuery: 'Japan',
    });

    expect(result.map((p) => p.id)).toEqual(['exact', 'prefix', 'substring']);
  });

  it('excludes soft-deleted packs even on an exact name match', () => {
    const result = matchPacksByName({ packs: [deleted], nameQuery: 'Old Japan Trip' });
    expect(result).toEqual([]);
  });

  it('excludes soft-deleted packs when listing everything', () => {
    const result = matchPacksByName({ packs: [japanTrip, skiWeekend, deleted] });
    expect(result.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('lists every live pack when the query is omitted, empty or whitespace', () => {
    for (const nameQuery of [undefined, null, '', '   ']) {
      const result = matchPacksByName({ packs: [japanTrip, skiWeekend], nameQuery });
      expect(result.map((p) => p.id)).toEqual(['p1', 'p2']);
    }
  });

  it('returns an empty array when nothing matches', () => {
    const result = matchPacksByName({ packs: [japanTrip, skiWeekend], nameQuery: 'Patagonia' });
    expect(result).toEqual([]);
  });

  it('returns every pack that matches a shared substring', () => {
    const alpha = pack({ id: 'a', name: 'Japan Trip 2024' });
    const beta = pack({ id: 'b', name: 'Japan Trip 2025' });

    const result = matchPacksByName({ packs: [alpha, beta], nameQuery: 'Japan Trip' });
    expect(result.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('handles an empty pack list', () => {
    expect(matchPacksByName({ packs: [], nameQuery: 'Japan Trip' })).toEqual([]);
  });
});
