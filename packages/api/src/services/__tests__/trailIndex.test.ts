import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTrail, searchTrails, type TrailDb } from '../trailIndex';

const mockExecute = vi.fn();
const db: TrailDb = { tag: () => ({ execute: mockExecute }) };

const dialect = new PgDialect();
function lastQuery(): { sql: string; params: unknown[] } {
  const arg: SQL = mockExecute.mock.calls.at(-1)?.[0];
  const { sql, params } = dialect.sqlToQuery(arg);
  return { sql: sql.replace(/\s+/g, ' '), params };
}

const ENVELOPE = JSON.stringify({
  type: 'Polygon',
  coordinates: [
    [
      [-119.53, 37.74],
      [-119.53, 37.75],
      [-119.51, 37.75],
      [-119.51, 37.74],
      [-119.53, 37.74],
    ],
  ],
});

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'fe63954f-386b-4251-9d28-0a11ad044bc3',
  name: 'Half Dome Trail',
  length_m: 3284,
  center_lat: 37.75,
  center_lon: -119.52,
  bbox: ENVELOPE,
  distance_m: null,
  ...overrides,
});

beforeEach(() => mockExecute.mockReset());

describe('searchTrails', () => {
  it('maps rows to summaries with a [west, south, east, north] bbox', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [row({ distance_m: 4.4 })] });

    const trails = await searchTrails({ db, q: 'half', limit: 5 });

    expect(trails).toEqual([
      {
        id: 'fe63954f-386b-4251-9d28-0a11ad044bc3',
        name: 'Half Dome Trail',
        lengthM: 3284,
        center: { latitude: 37.75, longitude: -119.52 },
        bbox: [-119.53, 37.74, -119.51, 37.75],
        distanceM: 4,
      },
    ]);
  });

  it('returns a null bbox when the envelope is not a polygon', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [row({ bbox: '{"type":"Point"}' })] });

    const [trail] = await searchTrails({ db, q: 'half', limit: 5 });

    expect(trail?.bbox).toBeNull();
  });

  it('ranks a text-only search by similarity and escapes LIKE wildcards', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });

    await searchTrails({ db, q: ' 100%_trail ', limit: 5 });

    const { sql, params } = lastQuery();
    expect(sql).toContain('name ILIKE $1');
    expect(params[0]).toBe('%100\\%\\_trail%');
    expect(sql).toContain('ORDER BY similarity(name, $');
    expect(sql).not.toContain('<->');
    expect(sql).not.toContain('found');
  });

  it('orders by index distance and keeps only nearby trails for a location alone', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });

    await searchTrails({ db, lat: 37.7, lon: -119.5, limit: 3 });

    const { sql, params } = lastQuery();
    expect(sql).toContain('ORDER BY geom <-> ST_SetSRID(ST_MakePoint(');
    expect(sql).not.toContain('ILIKE');
    expect(sql).toMatch(/\) found WHERE distance_m <= \$\d+ ORDER BY distance_m$/);
    expect(params).toEqual(expect.arrayContaining([-119.5, 37.7, 3, 25_000]));
  });

  it('matches the name and orders by distance without a radius when both are given', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });

    await searchTrails({ db, q: 'mist', lat: 37.7, lon: -119.5, limit: 3 });

    const { sql } = lastQuery();
    expect(sql).toContain('name ILIKE');
    expect(sql).toContain('<->');
    expect(sql).not.toContain('distance_m <=');
  });
});

describe('getTrail', () => {
  it('returns the trail with parsed GeoJSON geometry', async () => {
    const geometry = { type: 'MultiLineString', coordinates: [[[-119.5, 37.7]]] };
    mockExecute.mockResolvedValueOnce({ rows: [row({ geometry: JSON.stringify(geometry) })] });

    const trail = await getTrail({ db, id: 'fe63954f-386b-4251-9d28-0a11ad044bc3' });

    expect(trail?.name).toBe('Half Dome Trail');
    expect(trail?.geometry).toEqual(geometry);
    expect(lastQuery().params).toEqual(['fe63954f-386b-4251-9d28-0a11ad044bc3']);
  });

  it('returns null when no trail has the id', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });

    expect(await getTrail({ db, id: '00000000-0000-0000-0000-000000000000' })).toBeNull();
  });
});
