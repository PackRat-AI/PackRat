import type { TrailConditionReport } from '@packrat/db/schema';
import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Every query starts with `db.tag(label)`; the fake db resolves each tagged
 * chain with the rows queued for that label, defaulting to `[]`.
 */
const mocks = vi.hoisted(() => ({
  labels: [] as string[],
  results: new Map<string, unknown[]>(),
  captureApiException: vi.fn(),
}));

vi.mock('@packrat/api/db', () => ({
  createDb: () => ({
    tag: (label: string) => {
      mocks.labels.push(label);
      const chain: object = new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === 'then') {
              const value = mocks.results.get(label) ?? [];
              return (resolve: (v: unknown) => void) => resolve(value);
            }
            return () => chain;
          },
        },
      );
      return chain;
    },
  }),
}));

vi.mock('@packrat/api/services/reportVisibility', () => ({
  visibleToViewer: () => sql`true`,
}));

vi.mock('@packrat/api/utils/sentry', () => ({
  captureApiException: mocks.captureApiException,
}));

import { createDb } from '@packrat/api/db';
import type { TrailDb } from '../trailIndex';
import {
  distanceMeters,
  getTripTrailConditions,
  rankNearbyReports,
  TRIP_REPORT_LIMIT,
} from '../tripTrailConditions';

const YOSEMITE_VALLEY = { latitude: 37.7459, longitude: -119.5332 };
// A pin about 4 km east of the valley.
const PIN = { latitude: 37.7459, longitude: -119.5332 + 0.05 };

const report = (overrides: Partial<TrailConditionReport>): TrailConditionReport => ({
  id: 'r',
  trailId: null,
  trailName: 'Trail',
  trailRegion: null,
  latitude: null,
  longitude: null,
  surface: 'dirt',
  overallCondition: 'good',
  hazards: [],
  waterCrossings: 0,
  waterCrossingDifficulty: null,
  notes: null,
  photos: [],
  userId: 'u',
  tripId: null,
  deleted: false,
  localCreatedAt: new Date('2026-10-01T00:00:00Z'),
  localUpdatedAt: new Date('2026-10-01T00:00:00Z'),
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
  ...overrides,
});

describe('distanceMeters', () => {
  it('measures Yosemite Valley to Half Dome summit at about 4 km', () => {
    const d = distanceMeters({
      from: YOSEMITE_VALLEY,
      to: { latitude: 37.7459, longitude: -119.5332 + 0.0455 },
    });
    expect(Math.round(d / 100)).toBe(40);
  });

  it('is zero between a point and itself', () => {
    expect(distanceMeters({ from: YOSEMITE_VALLEY, to: YOSEMITE_VALLEY })).toBe(0);
  });
});

describe('rankNearbyReports', () => {
  it('orders trail and pin reports nearest first, labelled with their distance', () => {
    const ranked = rankNearbyReports({
      origin: YOSEMITE_VALLEY,
      trailDistances: new Map([
        ['far-trail', 9_000.4],
        ['near-trail', 1_200.6],
      ]),
      trailReports: [
        report({ id: 'far', trailId: 'far-trail' }),
        report({ id: 'near', trailId: 'near-trail' }),
      ],
      pinReports: [report({ id: 'pin', ...PIN })],
    });

    expect(Math.round(distanceMeters({ from: YOSEMITE_VALLEY, to: PIN }) / 1000)).toBe(4);
    expect(ranked.map((r) => [r.id, r.distanceM])).toEqual([
      ['near', 1201],
      ['pin', Math.round(distanceMeters({ from: YOSEMITE_VALLEY, to: PIN }))],
      ['far', 9000],
    ]);
  });

  it('puts the more recently written report first when two are the same distance away', () => {
    const ranked = rankNearbyReports({
      origin: YOSEMITE_VALLEY,
      trailDistances: new Map([
        ['a', 500],
        ['b', 500],
      ]),
      trailReports: [
        report({ id: 'older', trailId: 'a', localCreatedAt: new Date('2026-09-01T00:00:00Z') }),
        report({ id: 'newer', trailId: 'b', localCreatedAt: new Date('2026-10-05T00:00:00Z') }),
      ],
      pinReports: [],
    });

    expect(ranked.map((r) => r.id)).toEqual(['newer', 'older']);
  });

  it('drops pins beyond the trip radius and trail reports for trails not nearby', () => {
    const ranked = rankNearbyReports({
      origin: YOSEMITE_VALLEY,
      trailDistances: new Map([['near-trail', 100]]),
      trailReports: [report({ id: 'stray', trailId: 'other-trail' })],
      pinReports: [
        report({ id: 'far-pin', latitude: 38.2, longitude: -119.5332 }), // ≈ 50 km
        report({ id: 'no-coords' }),
      ],
    });

    expect(ranked).toEqual([]);
  });

  it(`keeps at most ${TRIP_REPORT_LIMIT} reports`, () => {
    const ids = Array.from({ length: 8 }, (_, i) => `t${i}`);
    const ranked = rankNearbyReports({
      origin: YOSEMITE_VALLEY,
      trailDistances: new Map(ids.map((id, i) => [id, i * 100])),
      trailReports: ids.map((id) => report({ id, trailId: id })),
      pinReports: [],
    });

    expect(ranked.map((r) => r.id)).toEqual(['t0', 't1', 't2', 't3', 't4']);
  });
});

describe('getTripTrailConditions', () => {
  const db = createDb();
  const trailExecute = vi.fn();
  const trailDb: TrailDb = { tag: () => ({ execute: trailExecute }) };
  const trip = { id: 'trip-1', trailId: null, location: YOSEMITE_VALLEY };

  beforeEach(() => {
    mocks.labels.length = 0;
    mocks.results.clear();
    mocks.captureApiException.mockReset();
    trailExecute.mockReset();
  });

  it("shows the named trail's latest reports, without distances", async () => {
    mocks.results.set('tripTrailConditions.trailReports', [report({ id: 'a', trailId: 't1' })]);

    const result = await getTripTrailConditions({
      db,
      trailDb,
      trip: { ...trip, trailId: 't1' },
      viewerId: 'viewer',
    });

    expect(result).toEqual({
      scope: 'trail',
      reports: [{ ...report({ id: 'a', trailId: 't1' }), distanceM: null }],
    });
    expect(trailExecute).toHaveBeenCalledTimes(0);
  });

  it('has nowhere to look when the trip names no trail and has no location', async () => {
    const result = await getTripTrailConditions({
      db,
      trailDb,
      trip: { ...trip, location: null },
      viewerId: 'viewer',
    });

    expect(result).toEqual({ scope: 'none', reports: [] });
    expect(mocks.labels).toEqual([]);
  });

  it('ranks reports on trails within the radius alongside nearby pins', async () => {
    trailExecute.mockResolvedValueOnce({
      rows: [
        { id: 'near-trail', distance_m: 1_000 },
        { id: 'far-trail', distance_m: 40_000 },
      ],
    });
    mocks.results.set('tripTrailConditions.nearbyTrailReports', [
      report({ id: 'trail-report', trailId: 'near-trail' }),
    ]);
    mocks.results.set('tripTrailConditions.nearbyPinReports', [report({ id: 'pin', ...PIN })]);

    const result = await getTripTrailConditions({ db, trailDb, trip, viewerId: 'viewer' });

    expect(result.scope).toBe('nearby');
    expect(result.reports.map((r) => [r.id, r.distanceM])).toEqual([
      ['trail-report', 1000],
      ['pin', Math.round(distanceMeters({ from: YOSEMITE_VALLEY, to: PIN }))],
    ]);
  });

  it('falls back to pins and reports the error when the trail database fails', async () => {
    const outage = new Error('trail db down');
    trailExecute.mockRejectedValueOnce(outage);
    mocks.results.set('tripTrailConditions.nearbyPinReports', [report({ id: 'pin', ...PIN })]);

    const result = await getTripTrailConditions({ db, trailDb, trip, viewerId: 'viewer' });

    expect(result.reports.map((r) => r.id)).toEqual(['pin']);
    expect(mocks.captureApiException).toHaveBeenCalledWith({
      error: outage,
      operation: 'tripTrailConditions.nearbyTrails',
      extra: { tripId: 'trip-1' },
    });
    expect(mocks.labels).not.toContain('tripTrailConditions.nearbyTrailReports');
  });

  it('uses pins only when no trail database is configured', async () => {
    mocks.results.set('tripTrailConditions.nearbyPinReports', [report({ id: 'pin', ...PIN })]);

    const result = await getTripTrailConditions({ db, trailDb: null, trip, viewerId: 'viewer' });

    expect(result).toEqual({
      scope: 'nearby',
      reports: [
        {
          ...report({ id: 'pin', ...PIN }),
          distanceM: Math.round(distanceMeters({ from: YOSEMITE_VALLEY, to: PIN })),
        },
      ],
    });
    expect(trailExecute).toHaveBeenCalledTimes(0);
  });
});
