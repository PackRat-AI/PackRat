import { describe, expect, it } from 'vitest';
import { toTrailDetail, toTrailGeometry, toTrailSummary } from './transform';
import type { OverpassElement } from './types';

const baseElement: OverpassElement = {
  type: 'relation',
  id: 12345,
  tags: {
    name: 'Pacific Crest Trail',
    route: 'hiking',
    network: 'nwn',
    distance: '4265 km',
    difficulty: 'demanding',
    description: 'Long-distance hiking trail',
  },
  bounds: { minlat: 32.5, minlon: -120.8, maxlat: 49.0, maxlon: -117.1 },
  members: [],
};

describe('toTrailSummary()', () => {
  it('maps all known tag fields', () => {
    const summary = toTrailSummary(baseElement);
    expect(summary).toEqual({
      osmId: '12345',
      name: 'Pacific Crest Trail',
      sport: 'hiking',
      network: 'nwn',
      distance: '4265 km',
      difficulty: 'demanding',
      description: 'Long-distance hiking trail',
      bbox: [-120.8, 32.5, -117.1, 49.0],
    });
  });

  it('returns null for missing optional fields', () => {
    const el: OverpassElement = { type: 'relation', id: 1 };
    const summary = toTrailSummary(el);
    expect(summary.name).toBeNull();
    expect(summary.sport).toBeNull();
    expect(summary.network).toBeNull();
    expect(summary.distance).toBeNull();
    expect(summary.difficulty).toBeNull();
    expect(summary.description).toBeNull();
    expect(summary.bbox).toBeNull();
  });

  it('falls back to length tag when distance is absent', () => {
    const el: OverpassElement = { type: 'relation', id: 2, tags: { length: '50 km' } };
    expect(toTrailSummary(el).distance).toBe('50 km');
  });

  it('falls back to sac_scale for difficulty', () => {
    const el: OverpassElement = { type: 'relation', id: 3, tags: { sac_scale: 'T3' } };
    expect(toTrailSummary(el).difficulty).toBe('T3');
  });

  it('falls back to mtb:scale for difficulty', () => {
    const el: OverpassElement = { type: 'relation', id: 4, tags: { 'mtb:scale': '2' } };
    expect(toTrailSummary(el).difficulty).toBe('2');
  });

  it('bbox is [minlon, minlat, maxlon, maxlat]', () => {
    const summary = toTrailSummary(baseElement);
    // GeoJSON bbox convention: [west, south, east, north]
    expect(summary.bbox).toEqual([-120.8, 32.5, -117.1, 49.0]);
  });
});

describe('toTrailGeometry()', () => {
  it('returns null when there are no members', () => {
    expect(toTrailGeometry({ ...baseElement, members: [] })).toBeNull();
  });

  it('returns null when no way members have geometry', () => {
    const el: OverpassElement = {
      ...baseElement,
      members: [{ type: 'node', ref: 1, role: 'start' }],
    };
    expect(toTrailGeometry(el)).toBeNull();
  });

  it('returns LineString for a single way member', () => {
    const el: OverpassElement = {
      ...baseElement,
      members: [
        {
          type: 'way',
          ref: 100,
          role: '',
          geometry: [
            { lat: 37.0, lon: -119.0 },
            { lat: 37.1, lon: -119.1 },
          ],
        },
      ],
    };
    const geo = toTrailGeometry(el);
    expect(geo).toEqual({
      type: 'LineString',
      coordinates: [
        [-119.0, 37.0],
        [-119.1, 37.1],
      ],
    });
  });

  it('returns MultiLineString for multiple way members', () => {
    const el: OverpassElement = {
      ...baseElement,
      members: [
        {
          type: 'way',
          ref: 100,
          role: '',
          geometry: [
            { lat: 37.0, lon: -119.0 },
            { lat: 37.1, lon: -119.1 },
          ],
        },
        {
          type: 'way',
          ref: 101,
          role: '',
          geometry: [
            { lat: 37.1, lon: -119.1 },
            { lat: 37.2, lon: -119.2 },
          ],
        },
      ],
    };
    const geo = toTrailGeometry(el);
    expect(geo?.type).toBe('MultiLineString');
    expect((geo as { coordinates: unknown[][] }).coordinates).toHaveLength(2);
  });

  it('skips way members with empty geometry arrays', () => {
    const el: OverpassElement = {
      ...baseElement,
      members: [
        { type: 'way', ref: 100, role: '', geometry: [] },
        {
          type: 'way',
          ref: 101,
          role: '',
          geometry: [
            { lat: 37.0, lon: -119.0 },
            { lat: 37.1, lon: -119.1 },
          ],
        },
      ],
    };
    const geo = toTrailGeometry(el);
    // Only one valid way → LineString
    expect(geo?.type).toBe('LineString');
  });

  it('coordinates are [lon, lat] (GeoJSON order)', () => {
    const el: OverpassElement = {
      ...baseElement,
      members: [
        {
          type: 'way',
          ref: 100,
          role: '',
          geometry: [{ lat: 48.8566, lon: 2.3522 }],
        },
      ],
    };
    const geo = toTrailGeometry(el) as { type: string; coordinates: [number, number][] };
    expect(geo.coordinates[0]).toEqual([2.3522, 48.8566]);
  });
});

describe('toTrailDetail()', () => {
  it('merges summary and geometry', () => {
    const el: OverpassElement = {
      ...baseElement,
      members: [
        {
          type: 'way',
          ref: 100,
          role: '',
          geometry: [
            { lat: 37.0, lon: -119.0 },
            { lat: 37.1, lon: -119.1 },
          ],
        },
      ],
    };
    const detail = toTrailDetail(el);
    expect(detail.osmId).toBe('12345');
    expect(detail.name).toBe('Pacific Crest Trail');
    expect(detail.geometry?.type).toBe('LineString');
  });

  it('geometry is null when no way members have geometry', () => {
    const detail = toTrailDetail({ ...baseElement, members: [] });
    expect(detail.geometry).toBeNull();
  });
});
