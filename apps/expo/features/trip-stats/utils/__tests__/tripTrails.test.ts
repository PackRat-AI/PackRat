import type { TripTrail } from '@packrat/schemas/trips';
import { describe, expect, it } from 'vitest';
import { decodePolyline, encodePolyline } from '../polyline';
import { finishedTrips, type StatsTrip } from '../tripStats';
import { computeTripTrails, joinTrailParts, trailRoute } from '../tripTrails';

const NOW = new Date(2026, 9, 5, 12);

const MIST: TripTrail = {
  id: '6f1c2c4e-0000-4000-8000-000000000001',
  name: 'Mist Trail',
  lengthMeters: 3284,
};
const HALF_DOME: TripTrail = {
  id: '6f1c2c4e-0000-4000-8000-000000000002',
  name: 'Half Dome Trail',
  lengthMeters: 2392,
};

function trip({
  id,
  start,
  trails,
  excluded = false,
}: {
  id: string;
  start: string;
  trails: TripTrail[];
  excluded?: boolean;
}): StatsTrip {
  return {
    id,
    name: `Trip ${id}`,
    startDate: start,
    endDate: start,
    excludedFromStats: excluded,
    log: { activities: [], trails },
  };
}

function recordOf(trips: StatsTrip[]) {
  return computeTripTrails(finishedTrips({ trips, now: NOW }));
}

describe('computeTripTrails', () => {
  it('lists each trail once, most recently walked first, with its walks newest first', () => {
    const record = recordOf([
      trip({ id: 'a', start: '2026-05-01', trails: [MIST, HALF_DOME] }),
      trip({ id: 'b', start: '2026-08-01', trails: [MIST] }),
    ]);
    expect(record.trails.map((item) => item.trail.name)).toEqual(['Mist Trail', 'Half Dome Trail']);
    expect(record.trails[0]?.walks.map((walk) => walk.tripId)).toEqual(['b', 'a']);
    expect(record.totalLengthMeters).toBe(3284 + 2392);
    expect(record.walkCount).toBe(3);
  });

  it('is empty with no logged trails, and skips trips left out of stats', () => {
    expect(recordOf([trip({ id: 'a', start: '2026-05-01', trails: [] })]).trails).toEqual([]);
    expect(
      recordOf([trip({ id: 'a', start: '2026-05-01', trails: [MIST], excluded: true })]).trails,
    ).toEqual([]);
  });

  it('counts a trail named twice in one log as one walk', () => {
    const record = recordOf([trip({ id: 'a', start: '2026-05-01', trails: [MIST, MIST] })]);
    expect(record.trails[0]?.walks).toHaveLength(1);
  });

  it("uses the newest log's name for a renamed trail", () => {
    const record = recordOf([
      trip({ id: 'a', start: '2026-05-01', trails: [MIST] }),
      trip({ id: 'b', start: '2026-08-01', trails: [{ ...MIST, name: 'Mist Trail (John Muir)' }] }),
    ]);
    expect(record.trails.map((item) => item.trail.name)).toEqual(['Mist Trail (John Muir)']);
  });

  it('ignores trips that have not finished', () => {
    expect(recordOf([trip({ id: 'a', start: '2026-12-01', trails: [MIST] })]).trails).toEqual([]);
  });
});

describe('joinTrailParts', () => {
  it('chains parts end to end from the longest, flipping any that run backwards', () => {
    const main = [0, 0.01, 0.02].map((longitude) => ({ latitude: 0, longitude }));
    const backwards = [0.04, 0.03].map((longitude) => ({ latitude: 0, longitude }));
    const line = joinTrailParts([backwards, main]);
    expect(line.map((point) => point.longitude)).toEqual([0, 0.01, 0.02, 0.03, 0.04]);
  });

  it('drops parts too short to draw', () => {
    expect(joinTrailParts([])).toEqual([]);
    expect(joinTrailParts([[{ latitude: 1, longitude: 1 }]])).toEqual([]);
  });
});

describe('trailRoute', () => {
  it('encodes the joined parts as one route', () => {
    const lines = [
      encodePolyline([
        { latitude: 37.7, longitude: -119.5 },
        { latitude: 37.71, longitude: -119.5 },
      ]),
      encodePolyline([
        { latitude: 37.73, longitude: -119.5 },
        { latitude: 37.72, longitude: -119.5 },
      ]),
    ];
    const route = trailRoute(lines);
    expect(route && decodePolyline(route).map((point) => point.latitude)).toEqual([37.7, 37.73]);
  });

  it('is null for a trail with no drawable part', () => {
    expect(trailRoute([encodePolyline([{ latitude: 1, longitude: 1 }])])).toBeNull();
  });
});
