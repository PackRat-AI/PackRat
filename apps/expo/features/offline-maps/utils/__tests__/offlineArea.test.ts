import { describe, expect, it } from 'vitest';
import type { OfflineArea, OfflineAreaBounds } from '../../types';
import {
  BYTES_PER_TILE,
  boundsEnclosing,
  boundsFromCorners,
  boundsRing,
  estimateBytes,
  formatBytes,
  packFit,
  padBounds,
  sortAreas,
  TILE_PACK_BUDGET,
  tilePacks,
  tileRange,
  totalBytes,
  tripHasEnded,
} from '../offlineArea';

const yosemiteValley: OfflineAreaBounds = { south: 37.7, west: -119.7, north: 37.76, east: -119.5 };
const california: OfflineAreaBounds = { south: 32.5, west: -124.4, north: 42, east: -114.1 };

const area = (overrides: Partial<OfflineArea>): OfflineArea => ({
  id: 'a',
  name: 'Area',
  bounds: yosemiteValley,
  detail: 'standard',
  savedAt: 0,
  sizeBytes: 0,
  isComplete: true,
  ...overrides,
});

describe('boundsRing', () => {
  it('closes the ring counter-clockwise from the south-west corner', () => {
    expect(boundsRing({ south: 1, west: 2, north: 3, east: 4 })).toEqual([
      [2, 1],
      [4, 1],
      [4, 3],
      [2, 3],
      [2, 1],
    ]);
  });
});

describe('boundsEnclosing', () => {
  it('returns null for no points', () => {
    expect(boundsEnclosing([[], []])).toBeNull();
  });

  it('spans every point across every line', () => {
    expect(
      boundsEnclosing([
        [
          [-120, 37],
          [-119, 38],
        ],
        [[-121, 36.5]],
      ]),
    ).toEqual({ south: 36.5, west: -121, north: 38, east: -119 });
  });
});

describe('boundsFromCorners', () => {
  it('reads the north-east and south-west corners', () => {
    expect(boundsFromCorners({ ne: [-119.5, 37.76], sw: [-119.7, 37.7] })).toEqual(yosemiteValley);
  });

  it('returns null for an incomplete corner', () => {
    expect(boundsFromCorners({ ne: [-119.5], sw: [-119.7, 37.7] })).toBeNull();
  });
});

describe('padBounds', () => {
  it('adds a share of the span on every side', () => {
    expect(padBounds({ bounds: { south: 0, west: 0, north: 1, east: 2 }, fraction: 0.5 })).toEqual({
      south: -0.5,
      west: -1,
      north: 1.5,
      east: 3,
    });
  });

  it('gives a single point a minimum margin', () => {
    expect(padBounds({ bounds: { south: 10, west: 20, north: 10, east: 20 } })).toEqual({
      south: 9.98,
      west: 19.98,
      north: 10.02,
      east: 20.02,
    });
  });

  it('stays inside the map edges', () => {
    expect(
      padBounds({ bounds: { south: -84.99, west: -179.99, north: 84.99, east: 179.99 } }),
    ).toEqual({
      south: -85,
      west: -180,
      north: 85,
      east: 180,
    });
  });
});

describe('tileRange', () => {
  it('is the single world tile at zoom 0', () => {
    expect(tileRange({ bounds: california, zoom: 0 })).toEqual({
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
    });
  });

  it('puts north on the lower row number', () => {
    expect(tileRange({ bounds: yosemiteValley, zoom: 12 })).toEqual({
      minX: 686,
      maxX: 688,
      minY: 1583,
      maxY: 1584,
    });
  });
});

describe('estimateBytes', () => {
  it('prices every tile from zoom 0 to the detail level', () => {
    // One tile per zoom for a pinpoint area: 15 zooms at Standard, 17 at Trail.
    const point = { south: 37.74, west: -119.6, north: 37.74, east: -119.6 };
    expect(estimateBytes({ bounds: point, detail: 'standard' })).toBe(15 * BYTES_PER_TILE);
    expect(estimateBytes({ bounds: point, detail: 'trail' })).toBe(17 * BYTES_PER_TILE);
  });

  it('costs more at Trail detail', () => {
    expect(estimateBytes({ bounds: yosemiteValley, detail: 'trail' })).toBeGreaterThan(
      estimateBytes({ bounds: yosemiteValley, detail: 'standard' }) * 4,
    );
  });
});

describe('tilePacks', () => {
  it('keys one pack per index tile in each group', () => {
    expect([...tilePacks({ bounds: yosemiteValley, detail: 'standard' })].slice(0, 2)).toEqual([
      '0/0/0/0',
      '6/6/10/24',
    ]);
    expect(tilePacks({ bounds: yosemiteValley, detail: 'trail' }).size).toBeGreaterThan(
      tilePacks({ bounds: yosemiteValley, detail: 'standard' }).size,
    );
  });

  it('stops counting once far over the limit', () => {
    expect(tilePacks({ bounds: california, detail: 'trail', maxPacks: 10 }).size).toBe(11);
  });
});

describe('packFit', () => {
  it('fits a valley on an empty device', () => {
    expect(packFit({ bounds: yosemiteValley, detail: 'trail', saved: [] })).toEqual({
      fits: true,
      fitsAlone: true,
    });
  });

  it('flags a state at Trail detail as too large on its own', () => {
    expect(packFit({ bounds: california, detail: 'trail', saved: [] }).fitsAlone).toBe(false);
  });

  it('counts packs an area shares with saved ones only once', () => {
    const saved = [area({ detail: 'trail' })];
    expect(packFit({ bounds: yosemiteValley, detail: 'trail', saved }).fits).toBe(true);
  });

  it('runs out of room beside saved areas while still fitting alone', () => {
    // A strip one zoom-12 tile tall whose packs sit just under the budget.
    const wide = { south: 37.7, west: -125, north: 37.71, east: -100 };
    const alone = tilePacks({ bounds: wide, detail: 'trail' }).size;
    expect(alone).toBeLessThanOrEqual(TILE_PACK_BUDGET);
    const elsewhere = area({ bounds: { south: 45, west: -90, north: 47, east: -80 } });
    expect(packFit({ bounds: wide, detail: 'trail', saved: [elsewhere] })).toEqual({
      fits: false,
      fitsAlone: true,
    });
  });
});

describe('totalBytes', () => {
  it('adds every area', () => {
    expect(totalBytes([{ sizeBytes: 3 }, { sizeBytes: 4 }])).toBe(7);
  });
});

describe('tripHasEnded and sortAreas', () => {
  const now = 1_000;
  const ended = area({ id: 'ended', savedAt: 1, tripEndsAt: 500 });
  const upcoming = area({ id: 'upcoming', savedAt: 3, tripEndsAt: 5_000 });
  const plain = area({ id: 'plain', savedAt: 2 });

  it('treats only a past end date as ended', () => {
    expect(tripHasEnded({ area: ended, now })).toBe(true);
    expect(tripHasEnded({ area: upcoming, now })).toBe(false);
    expect(tripHasEnded({ area: plain, now })).toBe(false);
  });

  it('lists finished trips first, then newest first', () => {
    expect(sortAreas({ areas: [plain, upcoming, ended], now }).map((a) => a.id)).toEqual([
      'ended',
      'upcoming',
      'plain',
    ]);
  });
});

describe('formatBytes', () => {
  it.each([
    [512, '512 bytes'],
    [1_500, '1.5 KB'],
    [42_000_000, '42 MB'],
    [2_300_000_000, '2.3 GB'],
    [9_000_000_000_000_000, '9000 TB'],
  ])('formats %d as %s', (bytes, text) => {
    expect(formatBytes(bytes)).toBe(text);
  });
});
