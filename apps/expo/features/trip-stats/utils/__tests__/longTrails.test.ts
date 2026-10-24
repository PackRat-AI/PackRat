import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeGoalProgress, type StatsGoal } from '../goalProgress';
import {
  computeLongTrailProgress,
  type LongTrailCache,
  type LongTrailRow,
  localDistance,
  longTrailFromRow,
  makeLongTrail,
  STATION_SPACING_METERS,
  stationsWalked,
  walkedLines,
} from '../longTrails';
import { type Coordinate, encodePolyline } from '../polyline';
import { finishedTrips, type StatsTrip } from '../tripStats';

const NOW = new Date(2026, 9, 5, 12);

/** One degree of longitude due east along 40° N: about 85 km. */
const TRAIL = makeLongTrail({
  code: 'TST',
  name: 'Test Trail',
  officialMiles: 60,
  states: ['XX'],
  lines: [
    [
      { latitude: 40, longitude: -120 },
      { latitude: 40, longitude: -119 },
    ],
  ],
});

/** A route along the trail between two shares of its length, `offset` degrees off it. */
function route({ from, to, offset = 0.001 }: { from: number; to: number; offset?: number }) {
  const points: Coordinate[] = [];
  for (let share = from; share <= to + 1e-9; share += 0.01) {
    points.push({ latitude: 40 + offset, longitude: -120 + share });
  }
  return encodePolyline(points);
}

function trip({ id, start, line }: { id: string; start: string; line?: string }): StatsTrip {
  return {
    id,
    name: `Trip ${id}`,
    startDate: start,
    endDate: start,
    log: line ? { activities: [], route: line } : undefined,
  };
}

function progressOf(trips: StatsTrip[]) {
  return computeLongTrailProgress({ trail: TRAIL, finished: finishedTrips({ trips, now: NOW }) });
}

describe('long trail geometry', () => {
  it('cuts stations that add up to the line', () => {
    const [a, b] = TRAIL.lines[0] ?? [];
    const expected = a && b ? localDistance({ a, b }) : 0;
    expect(Math.abs(TRAIL.lineMeters - expected)).toBeLessThan(1);
    expect(TRAIL.stations).toHaveLength(Math.ceil(expected / STATION_SPACING_METERS));
    expect(
      TRAIL.stations.slice(0, -1).every((station) => station.meters === STATION_SPACING_METERS),
    ).toBe(true);
  });

  it('loads the bundled trails close to their official lengths', () => {
    const rows: LongTrailRow[] = JSON.parse(
      readFileSync(resolve(__dirname, '../../data/longTrails.json'), 'utf8'),
    );
    const trails = rows.map(longTrailFromRow);
    expect(trails.map((trail) => trail.code)).toEqual(['PCT', 'AT', 'CDT']);
    for (const trail of trails) {
      const ratio = trail.lineMeters / trail.officialMeters;
      expect(ratio).toBeGreaterThan(0.75);
      expect(ratio).toBeLessThan(1.05);
    }
    const pct = trails[0];
    expect(pct?.minLatitude).toBeLessThan(32.7);
    expect(pct?.maxLatitude).toBeGreaterThan(48.9);
  });

  it('handles empty and single-point lines', () => {
    const empty = makeLongTrail({ code: 'E', name: 'E', officialMiles: 1, states: [], lines: [] });
    expect(empty.stations).toEqual([]);
    expect(empty.minLatitude).toBe(0);
    expect(computeLongTrailProgress({ trail: empty, finished: [] }).fraction).toBe(0);
    expect(stationsWalked({ trail: TRAIL, route: [{ latitude: 40, longitude: -120 }] }).size).toBe(
      0,
    );
  });
});

describe('long trail progress', () => {
  it('walks the share a route covers, scaled to the official length', () => {
    const progress = progressOf([
      trip({ id: 'a', start: '2026-06-01', line: route({ from: 0, to: 0.25 }) }),
    ]);
    expect(progress.fraction).toBeCloseTo(0.25, 1);
    expect(progress.meters / TRAIL.officialMeters).toBeCloseTo(0.25, 1);
    expect(progress.trips.map((section) => section.trip.trip.id)).toEqual(['a']);
  });

  it('walks none of it from a kilometre off, or with no route', () => {
    const progress = progressOf([
      trip({ id: 'a', start: '2026-06-01', line: route({ from: 0, to: 0.5, offset: 0.01 }) }),
      trip({ id: 'b', start: '2026-06-02' }),
      trip({ id: 'c', start: '2026-06-03', line: route({ from: 0, to: 0.5, offset: 5 }) }),
    ]);
    expect(progress.walked.size).toBe(0);
    expect(progress.trips).toEqual([]);
  });

  it('counts a stretch walked twice once, and the later trip shows only what was new', () => {
    const progress = progressOf([
      trip({ id: 'later', start: '2026-08-01', line: route({ from: 0.2, to: 0.5 }) }),
      trip({ id: 'first', start: '2026-06-01', line: route({ from: 0, to: 0.3 }) }),
    ]);
    expect(progress.fraction).toBeCloseTo(0.5, 1);
    expect(progress.trips.map((section) => section.trip.trip.id)).toEqual(['first', 'later']);
    const later = progress.trips[1];
    expect((later?.meters ?? 0) / TRAIL.officialMeters).toBeCloseTo(0.3, 1);
    expect((later?.newMeters ?? 0) / TRAIL.officialMeters).toBeCloseTo(0.2, 1);
  });

  it('returns walked stretches as separate lines, split across trail lines', () => {
    const progress = progressOf([
      trip({ id: 'a', start: '2026-06-01', line: route({ from: 0, to: 0.2 }) }),
      trip({ id: 'b', start: '2026-07-01', line: route({ from: 0.6, to: 0.8 }) }),
    ]);
    const lines = walkedLines(progress);
    expect(lines).toHaveLength(2);
    expect(lines.every((line) => line.length >= 2)).toBe(true);

    const twoLines = makeLongTrail({
      code: 'TWO',
      name: 'Two',
      officialMiles: 2,
      states: [],
      lines: [
        [
          { latitude: 0, longitude: 0 },
          { latitude: 0, longitude: 0.01 },
        ],
        [
          { latitude: 0, longitude: 0.01 },
          { latitude: 0, longitude: 0.02 },
        ],
      ],
    });
    const all = new Set(twoLines.stations.map((_, index) => index));
    expect(
      walkedLines({ trail: twoLines, walked: all, fraction: 1, meters: 0, trips: [] }),
    ).toHaveLength(2);
  });

  it('walks the trail between the points of a sparse route', () => {
    const sparse = encodePolyline([
      { latitude: 40.001, longitude: -120 },
      { latitude: 40.001, longitude: -119.5 },
    ]);
    expect(progressOf([trip({ id: 'a', start: '2026-06-01', line: sparse })]).fraction).toBeCloseTo(
      0.5,
      1,
    );
  });

  it('reuses a cached answer until the route changes', () => {
    const cache: LongTrailCache = new Map();
    const first = route({ from: 0, to: 0.1 });
    const finished = finishedTrips({
      trips: [trip({ id: 'a', start: '2026-06-01', line: first })],
      now: NOW,
    });
    const before = computeLongTrailProgress({ trail: TRAIL, finished, cache });
    expect(cache.get('TST|a')?.route).toBe(first);
    // A primed answer is read back rather than worked out again.
    cache.set('TST|a', { route: first, walked: new Set([0]) });
    expect(computeLongTrailProgress({ trail: TRAIL, finished, cache }).walked.size).toBe(1);
    const moved = finishedTrips({
      trips: [trip({ id: 'a', start: '2026-06-01', line: route({ from: 0, to: 0.4 }) })],
      now: NOW,
    });
    expect(
      computeLongTrailProgress({ trail: TRAIL, finished: moved, cache }).fraction,
    ).toBeGreaterThan(before.fraction);
  });
});

describe('long-trail goals', () => {
  it('reads the trail, with no pace until it has a finish date', () => {
    const progress = progressOf([
      trip({ id: 'a', start: '2025-06-01', line: route({ from: 0, to: 0.5 }) }),
    ]);
    const goal: StatsGoal = {
      id: 'g',
      kind: 'longTrail',
      metric: 'distance',
      target: TRAIL.officialMeters,
      startDate: '2026-01-01',
      trailCode: 'TST',
      deleted: false,
    };
    const longTrailMeters = (code: string) => (code === 'TST' ? progress.meters : null);
    const open = computeGoalProgress({ goal, finished: [], longTrailMeters, now: NOW });
    expect(open?.value).toBeCloseTo(progress.meters);
    expect(open?.phase).toBe('active');
    expect(open?.end).toBeNull();
    expect(open?.pace).toBeNull();

    const dated = computeGoalProgress({
      goal: { ...goal, endDate: '2026-12-31' },
      finished: [],
      longTrailMeters,
      now: NOW,
    });
    expect(dated?.pace?.kind).toBe('behind');
  });
});
