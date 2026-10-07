import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ queryOverpass: vi.fn() }));

vi.mock('@packrat/overpass', () => ({ queryOverpass: mocks.queryOverpass }));

import {
  buildPeaksQuery,
  findNearbyPeaks,
  NEARBY_PEAKS_LIMIT,
  PEAKS_CACHE_SECONDS,
  parseElevation,
  peaksCacheKey,
  snapBounds,
  sortPeaks,
  toNearbyPeak,
} from '../peaksService';

const overpassResponse = (elements: unknown[]) => ({
  version: 0.6,
  generator: 'Overpass API',
  osm3s: { timestamp_osm_base: '2026-10-06T00:00:00Z', copyright: 'OSM' },
  elements,
});

describe('parseElevation', () => {
  it.each([
    ['4392', 4392],
    ['4392 m', 4392],
    ['4392.4m', 4392.4],
    ['14505 ft', 4421.1],
    ["14,505'", 4421.1],
    ['4421;4418', 4421],
    ['-86', -86],
  ])('reads %s as %d metres', (raw, metres) => {
    expect(parseElevation(raw)).toBe(metres);
  });

  it.each([undefined, '', 'about 4000', '4000 yards', 'NaN'])('returns null for %s', (raw) => {
    expect(parseElevation(raw)).toBeNull();
  });
});

describe('toNearbyPeak', () => {
  it('keeps a named node with its position and height', () => {
    expect(
      toNearbyPeak({
        type: 'node',
        id: 358_793_812,
        lat: 46.8529,
        lon: -121.7604,
        tags: { natural: 'peak', name: ' Mount Rainier ', ele: '4392' },
      }),
    ).toEqual({
      osmId: 358_793_812,
      name: 'Mount Rainier',
      elevationMeters: 4392,
      latitude: 46.8529,
      longitude: -121.7604,
    });
  });

  it('drops unnamed peaks, non-nodes and nodes without a position', () => {
    expect(toNearbyPeak({ type: 'node', id: 1, lat: 1, lon: 1, tags: {} })).toBeNull();
    expect(toNearbyPeak({ type: 'way', id: 2, tags: { name: 'Ridge' } })).toBeNull();
    expect(toNearbyPeak({ type: 'node', id: 3, tags: { name: 'Lost Peak' } })).toBeNull();
  });
});

describe('sortPeaks', () => {
  it('puts the highest first and unknown heights last, by name', () => {
    const peak = (name: string, elevationMeters: number | null) => ({
      osmId: name.length,
      name,
      elevationMeters,
      latitude: 0,
      longitude: 0,
    });
    const sorted = sortPeaks([
      peak('B', null),
      peak('Low', 100),
      peak('A', null),
      peak('High', 900),
    ]);
    expect(sorted.map((p) => p.name)).toEqual(['High', 'Low', 'A', 'B']);
  });
});

describe('buildPeaksQuery', () => {
  it('asks for named peak nodes in south,west,north,east order', () => {
    expect(buildPeaksQuery({ south: 46.7, west: -121.9, north: 46.9, east: -121.6 })).toBe(
      '[out:json][timeout:20];node["natural"="peak"]["name"](46.7,-121.9,46.9,-121.6);out body;',
    );
  });
});

describe('findNearbyPeaks', () => {
  // Braced: a function returned from beforeEach runs as teardown, and mockReset returns the mock.
  beforeEach(() => {
    mocks.queryOverpass.mockReset();
  });

  it('returns usable peaks, highest first, capped at the limit', async () => {
    const many = Array.from({ length: NEARBY_PEAKS_LIMIT + 5 }, (_, i) => ({
      type: 'node',
      id: i + 10,
      lat: 46,
      lon: -121,
      tags: { name: `Peak ${i}`, ele: String(i) },
    }));
    mocks.queryOverpass.mockResolvedValue(
      overpassResponse([{ type: 'node', id: 1, lat: 46, lon: -121, tags: {} }, ...many]),
    );

    const peaks = await findNearbyPeaks({ south: 46, west: -122, north: 47, east: -121 });

    expect(mocks.queryOverpass).toHaveBeenCalledWith({
      ql: buildPeaksQuery({ south: 46, west: -122, north: 47, east: -121 }),
    });
    expect(peaks).toHaveLength(NEARBY_PEAKS_LIMIT);
    expect(peaks[0]?.name).toBe(`Peak ${NEARBY_PEAKS_LIMIT + 4}`);
    expect(peaks.some((p) => p.osmId === 1)).toBe(false);
  });

  it('retries once when Overpass is busy', async () => {
    mocks.queryOverpass
      .mockRejectedValueOnce(new Error('Overpass request failed: 504'))
      .mockResolvedValueOnce(
        overpassResponse([{ type: 'node', id: 7, lat: 1, lon: 1, tags: { name: 'Second Try' } }]),
      );
    const peaks = await findNearbyPeaks({ south: 0, west: 0, north: 1, east: 1 });
    expect(peaks.map((p) => p.name)).toEqual(['Second Try']);
    expect(mocks.queryOverpass).toHaveBeenCalledTimes(2);
  });

  it('lets a second Overpass failure through to the caller', async () => {
    mocks.queryOverpass.mockRejectedValue(new Error('Overpass request failed: 429'));
    await expect(findNearbyPeaks({ south: 0, west: 0, north: 1, east: 1 })).rejects.toThrow('429');
  });
});

describe('caching', () => {
  const store = new Map<string, Response>();
  const cache = {
    match: vi.fn(async (key: string) => store.get(key)?.clone()),
    put: vi.fn(async (key: string, response: Response) => {
      store.set(key, response);
    }),
  };

  beforeEach(() => {
    store.clear();
    cache.match.mockClear();
    cache.put.mockClear();
    mocks.queryOverpass.mockReset();
    vi.stubGlobal('caches', { default: cache });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('snaps a box outward to the 0.01° grid', () => {
    expect(
      snapBounds({ south: 46.7512, west: -121.9049, north: 46.9488, east: -121.6011 }),
    ).toEqual({
      south: 46.75,
      west: -121.91,
      north: 46.95,
      east: -121.6,
    });
  });

  it('gives boxes a pan apart inside one grid cell the same key', () => {
    expect(peaksCacheKey({ south: 46.751, west: -121.901, north: 46.948, east: -121.602 })).toBe(
      peaksCacheKey({ south: 46.752, west: -121.903, north: 46.946, east: -121.601 }),
    );
  });

  it('asks Overpass once, then answers repeats from the cache for a week', async () => {
    mocks.queryOverpass.mockResolvedValue(
      overpassResponse([
        { type: 'node', id: 5, lat: 46.85, lon: -121.76, tags: { name: 'Rainier', ele: '4392' } },
      ]),
    );
    const bounds = { south: 46.751, west: -121.901, north: 46.948, east: -121.602 };

    const first = await findNearbyPeaks(bounds);
    const second = await findNearbyPeaks({ ...bounds, south: 46.752 });

    expect(mocks.queryOverpass).toHaveBeenCalledTimes(1);
    expect(mocks.queryOverpass).toHaveBeenCalledWith({
      ql: buildPeaksQuery({ south: 46.75, west: -121.91, north: 46.95, east: -121.6 }),
    });
    expect(second).toEqual(first);
    const stored = cache.put.mock.calls[0]?.[1];
    expect(stored?.headers.get('Cache-Control')).toBe(`public, max-age=${PEAKS_CACHE_SECONDS}`);
  });

  it('caches nothing when Overpass fails', async () => {
    mocks.queryOverpass.mockRejectedValue(new Error('Overpass request failed: 504'));
    await expect(findNearbyPeaks({ south: 0, west: 0, north: 1, east: 1 })).rejects.toThrow('504');
    expect(cache.put).not.toHaveBeenCalled();
  });
});
