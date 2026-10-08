import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import {
  getTrail,
  likePattern,
  matchRoute,
  searchTrails,
  TRAIL_MATCH_BUFFER_METERS,
  TRAIL_MATCH_MIN_COVERAGE,
  TRAIL_SEARCH_LIMIT,
  type TrailDb,
  toTrailSummary,
} from '../trailRegistry';

const dialect = new PgDialect();

/** A trail db that records each query and answers with `result`. */
function fakeDb(result: unknown) {
  const calls: Array<{ label: string; sql: string; params: unknown[] }> = [];
  const db: TrailDb = {
    tag: (label) => ({
      execute: async (query: SQL) => {
        const { sql, params } = dialect.sqlToQuery(query);
        calls.push({ label, sql: sql.replace(/\s+/g, ' '), params });
        return result;
      },
    }),
  };
  return { db, calls };
}

const halfDome = {
  id: 'fe63954f-386b-4251-9d28-0a11ad044bc3',
  name: 'Half Dome Trail',
  length_m: '3284',
  west: -119.53,
  south: 37.74,
  east: -119.51,
  north: 37.75,
};

describe('toTrailSummary', () => {
  it('rounds lengths and keeps the bbox in west, south, east, north order', () => {
    expect(toTrailSummary({ ...halfDome, length_m: 3284.4, distance_m: 613.7 })).toEqual({
      id: halfDome.id,
      name: 'Half Dome Trail',
      lengthMeters: 3284,
      distanceMeters: 614,
      bbox: [-119.53, 37.74, -119.51, 37.75],
    });
  });

  it('leaves distance null when no point was given', () => {
    expect(toTrailSummary({ ...halfDome, length_m: 3284 }).distanceMeters).toBeNull();
  });
});

describe('likePattern', () => {
  it('wraps the text and escapes LIKE wildcards', () => {
    expect(likePattern('half dome')).toBe('%half dome%');
    expect(likePattern('100%_trail\\')).toBe('%100\\%\\_trail\\\\%');
  });
});

describe('searchTrails', () => {
  it('searches by name across the registry, longest first among equal matches', async () => {
    const { db, calls } = fakeDb([{ ...halfDome, distance_m: null }]);
    const trails = await searchTrails({ db, query: { q: 'half dome' } });

    expect(trails.map((t) => t.name)).toEqual(['Half Dome Trail']);
    expect(calls[0]?.label).toBe('trailRegistry.search');
    expect(calls[0]?.sql).toContain('t.name ILIKE $1 OR t.name % $2');
    expect(calls[0]?.sql).toContain(
      'ORDER BY (t.name ILIKE $3) DESC, similarity(t.name, $4) DESC, t.length_m DESC',
    );
    expect(calls[0]?.sql).not.toContain('ST_DWithin');
    expect(calls[0]?.params).toEqual([
      '%half dome%',
      'half dome',
      'half dome%',
      'half dome',
      TRAIL_SEARCH_LIMIT,
    ]);
  });

  it('keeps a point search inside the radius and orders it nearest first', async () => {
    const { db, calls } = fakeDb({ rows: [{ ...halfDome, distance_m: 614 }] });
    const trails = await searchTrails({
      db,
      query: { lat: 37.74, lon: -119.53, radiusKm: 5, limit: 4 },
    });

    expect(trails[0]?.distanceMeters).toBe(614);
    expect(calls[0]?.sql).toContain('ST_DWithin(t.geom::geography');
    expect(calls[0]?.sql).toContain('ORDER BY distance_m ASC LIMIT');
    expect(calls[0]?.sql).not.toContain('similarity');
    expect(calls[0]?.params).toContain(5000);
    expect(calls[0]?.params.at(-1)).toBe(4);
  });

  it('never returns trails that vanished upstream', async () => {
    const { db, calls } = fakeDb([]);
    await expect(searchTrails({ db, query: { q: 'mist' } })).resolves.toEqual([]);
    expect(calls[0]?.sql).toContain('t.missing_since_release IS NULL');
  });
});

describe('getTrail', () => {
  it('returns the trail with one encoded polyline per part', async () => {
    const { db, calls } = fakeDb([{ ...halfDome, lines: ['abc', 'def'] }]);
    await expect(getTrail({ db, id: halfDome.id })).resolves.toEqual({
      id: halfDome.id,
      name: 'Half Dome Trail',
      lengthMeters: 3284,
      bbox: [-119.53, 37.74, -119.51, 37.75],
      lines: ['abc', 'def'],
    });
    expect(calls[0]?.sql).toContain('ST_AsEncodedPolyline(part.geom, 5)');
    expect(calls[0]?.params).toEqual([halfDome.id]);
  });

  it('returns null for an unknown id', async () => {
    const { db } = fakeDb([]);
    await expect(getTrail({ db, id: halfDome.id })).resolves.toBeNull();
  });
});

describe('matchRoute', () => {
  it('buffers the route and keeps trails it covers enough of', async () => {
    const { db, calls } = fakeDb([{ ...halfDome, coverage: '0.98765' }]);
    const matches = await matchRoute({ db, route: '_p~iF~ps|U' });

    expect(matches).toEqual([
      {
        id: halfDome.id,
        name: 'Half Dome Trail',
        lengthMeters: 3284,
        bbox: [-119.53, 37.74, -119.51, 37.75],
        coverage: 0.988,
      },
    ]);
    expect(calls[0]?.label).toBe('trailRegistry.match');
    expect(calls[0]?.sql).toContain('ST_LineFromEncodedPolyline($1, 5)');
    expect(calls[0]?.params).toEqual([
      '_p~iF~ps|U',
      TRAIL_MATCH_BUFFER_METERS,
      TRAIL_MATCH_MIN_COVERAGE,
      20,
    ]);
  });
});
