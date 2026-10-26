import type { NearbyPeak } from '@packrat/schemas/tripStats';
import { describe, expect, it } from 'vitest';
import {
  computeGoalProgress,
  goalFraction,
  goalRemaining,
  goalWindow,
  isGoalComplete,
  isMeasuredMetric,
  peaksClimbed,
  type StatsGoal,
  sortGoals,
} from '../goalProgress';
import {
  computeParksAndPeaks,
  entrySummit,
  highestAscent,
  latestParkVisit,
  normalizedPeakName,
  parkCenter,
  parkContains,
  parkFromRow,
  parksVisitedBetween,
  peakCount,
  peakKey,
  peaksSummitedBetween,
  type StatsEntry,
  visitedParks,
} from '../parksAndPeaks';
import { peakSearchBox, rankPeaks } from '../peakSuggestions';
import { encodePolyline } from '../polyline';
import { finishedTrips, type StatsTrip } from '../tripStats';

const NOW = new Date(2026, 5, 15, 10);

// A 1° square with a 0.2° hole in the middle.
const SQUARE = parkFromRow({
  code: 'SQR',
  name: 'Square',
  states: ['CA'],
  rings: [
    [-120, 37, -119, 37, -119, 38, -120, 38, -120, 37],
    [-119.6, 37.4, -119.4, 37.4, -119.4, 37.6, -119.6, 37.6, -119.6, 37.4],
  ],
});
const OTHER = parkFromRow({ code: 'OTH', name: 'Other', states: [], rings: [[0, 0, 1, 0, 1, 1]] });
const EMPTY = parkFromRow({ code: 'EMP', name: 'Empty', states: [], rings: [] });

function entry(overrides: Partial<StatsEntry> & Pick<StatsEntry, 'id' | 'kind'>): StatsEntry {
  return { deleted: false, ...overrides };
}

describe('national parks', () => {
  it('builds bounds and tests containment with holes', () => {
    expect(parkCenter(SQUARE)).toEqual({ latitude: 37.5, longitude: -119.5 });
    expect(parkContains({ park: SQUARE, point: { latitude: 37.2, longitude: -119.8 } })).toBe(true);
    expect(parkContains({ park: SQUARE, point: { latitude: 37.5, longitude: -119.5 } })).toBe(
      false,
    );
    expect(parkContains({ park: SQUARE, point: { latitude: 39, longitude: -119.5 } })).toBe(false);
    expect(parkContains({ park: EMPTY, point: { latitude: 0, longitude: 0 } })).toBe(false);
    expect(EMPTY.minLatitude).toBe(0);
  });
});

describe('peaks', () => {
  it('keys and normalises peak names', () => {
    expect(peakKey({ name: 'Whitney', osmId: 5 })).toBe('osm:5');
    expect(peakKey({ name: ' Whitney ' })).toBe('name:whitney');
    expect(normalizedPeakName('Mt. Whitney')).toBe('mount whitney');
    expect(normalizedPeakName('Mount  Whitney!')).toBe('mount whitney');
  });

  it('turns only named summit entries into summits', () => {
    expect(entrySummit(entry({ id: 'e', kind: 'park', parkCode: 'SQR' }))).toBeNull();
    expect(entrySummit(entry({ id: 'e', kind: 'summit' }))).toBeNull();
    expect(entrySummit(entry({ id: 'e', kind: 'summit', name: 'Half Dome' }))).toEqual({
      name: 'Half Dome',
      elevationMeters: null,
      latitude: 0,
      longitude: 0,
      osmId: null,
    });
  });
});

const trips: StatsTrip[] = [
  {
    id: 'inside',
    name: 'Inside',
    startDate: '2026-03-01',
    location: { latitude: 37.2, longitude: -119.8 },
    log: {
      activities: ['hiking'],
      distanceMeters: 10_000,
      summits: [
        { name: 'Mt. Hoffmann', elevationMeters: 3300, latitude: 37.8, longitude: -119.5 },
        { name: 'Clouds Rest', elevationMeters: 3025, latitude: 37.7, longitude: -119.4, osmId: 9 },
      ],
    },
  },
  {
    id: 'route',
    name: 'Route',
    startDate: '2026-05-01',
    endDate: '2026-05-03',
    log: {
      activities: [],
      route: encodePolyline([
        { latitude: 10, longitude: 10 },
        { latitude: 0.5, longitude: 0.5 },
      ]),
    },
  },
  { id: 'nowhere', name: 'Nowhere', startDate: '2026-04-01' },
];

const entries: StatsEntry[] = [
  entry({ id: 'p1', kind: 'park', parkCode: 'SQR', date: '2010-07-04' }),
  entry({ id: 'p2', kind: 'park', parkCode: 'OTH' }),
  entry({ id: 'p3', kind: 'park' }),
  entry({ id: 'p4', kind: 'park', parkCode: 'OTH', deleted: true }),
  entry({ id: 's1', kind: 'summit', name: 'Whitney', elevationMeters: 4421, osmId: 1 }),
  entry({ id: 's2', kind: 'summit', name: 'Clouds Rest', osmId: 9, date: '2026-01-05' }),
];

const finished = finishedTrips({ trips, now: NOW });
const record = computeParksAndPeaks({ finished, entries, parks: [SQUARE, OTHER, EMPTY] });

describe('computeParksAndPeaks', () => {
  it('ticks parks from locations, routes and hand-added visits', () => {
    expect(visitedParks(record).map((p) => p.park.code)).toEqual(['SQR', 'OTH']);
    const square = record.parks[0];
    expect(square?.visits.map((v) => v.id)).toEqual(['p1', 'trip:inside']);
    const other = record.parks[1];
    expect(other?.visits.map((v) => v.id)).toEqual(['trip:route', 'p2']);
    expect(latestParkVisit(record)?.park.code).toBe('OTH');
  });

  it('lists ascents newest first and counts distinct peaks', () => {
    expect(record.ascents.map((a) => a.id)).toEqual(['trip:inside:0', 'trip:inside:1', 's2', 's1']);
    expect(peakCount(record)).toBe(3);
    expect(highestAscent(record)?.id).toBe('s1');
  });

  it('counts parks and peaks inside a window', () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 11, 31);
    expect(parksVisitedBetween({ record, window: { start, end } })).toBe(2);
    expect(peaksSummitedBetween({ record, window: { start, end } })).toBe(2);
  });

  it('has no latest visit or highest ascent when empty', () => {
    const empty = computeParksAndPeaks({ finished: [], entries: [], parks: [SQUARE] });
    expect(latestParkVisit(empty)).toBeNull();
    expect(highestAscent(empty)).toBeNull();
  });
});

function goal(overrides: Partial<StatsGoal>): StatsGoal {
  return { id: 'g', kind: 'annual', metric: 'trips', target: 4, deleted: false, ...overrides };
}

describe('goal windows', () => {
  it('resolves each kind of window', () => {
    expect(goalWindow({ goal: goal({ year: 2026 }) })).toEqual({
      start: new Date(2026, 0, 1),
      end: new Date(2026, 11, 31),
    });
    expect(goalWindow({ goal: goal({ year: null }) })).toBeNull();
    expect(
      goalWindow({
        goal: goal({ kind: 'custom', startDate: '2026-03-01', endDate: '2026-02-01' }),
      }),
    ).toBeNull();
    expect(goalWindow({ goal: goal({ kind: 'custom', startDate: '2026-03-01' }) })).toBeNull();
    expect(
      goalWindow({
        goal: goal({ kind: 'parkList', localCreatedAt: '2026-02-03T12:00:00.000Z' }),
        now: NOW,
      })?.start.getMonth(),
    ).toBe(1);
    expect(goalWindow({ goal: goal({ kind: 'parkList' }), now: NOW })).toEqual({
      start: new Date(2026, 5, 15),
      end: null,
    });
    expect(
      goalWindow({
        goal: goal({ kind: 'peakList', startDate: '2026-05-01', endDate: '2026-04-01' }),
      }),
    ).toBeNull();
  });
});

describe('computeGoalProgress', () => {
  it('measures an annual goal against an even pace', () => {
    const progress = computeGoalProgress({ goal: goal({ year: 2026 }), finished, now: NOW });
    expect(progress?.phase).toBe('active');
    expect(progress?.value).toBe(3);
    expect(progress?.pace).toEqual({ kind: 'ahead', by: 1 });
    expect(progress && goalFraction(progress)).toBe(0.75);
    expect(progress && goalRemaining(progress)).toBe(1);
    expect(progress && isGoalComplete(progress)).toBe(false);
  });

  it('reads behind, on pace, and measured goals', () => {
    const behind = computeGoalProgress({
      goal: goal({ year: 2026, target: 20 }),
      finished,
      now: NOW,
    });
    expect(behind?.pace).toEqual({ kind: 'behind', by: 6 });
    const even = computeGoalProgress({ goal: goal({ year: 2026, target: 7 }), finished, now: NOW });
    expect(even?.pace).toEqual({ kind: 'onPace' });
    const distance = computeGoalProgress({
      goal: goal({ year: 2026, metric: 'distance', target: 10_000 }),
      finished,
      now: new Date(2026, 1, 1),
    });
    expect(distance?.value).toBe(10_000);
    const measured = computeGoalProgress({
      goal: goal({ year: 2026, metric: 'distance', target: 100_000 }),
      finished,
      now: NOW,
    });
    expect(measured?.pace?.kind).toBe('behind');
    expect(isMeasuredMetric('elevation')).toBe(true);
    expect(isMeasuredMetric('nights')).toBe(false);
  });

  it('covers every metric of a dated goal', () => {
    const value = (metric: StatsGoal['metric']) =>
      computeGoalProgress({
        goal: goal({ year: 2026, metric }),
        finished,
        parksAndPeaks: record,
        now: NOW,
      })?.value;
    expect(value('nights')).toBe(2);
    expect(value('days')).toBe(5);
    expect(value('elevation')).toBe(0);
    expect(value('summits')).toBe(2);
    expect(value('parks')).toBe(2);
    expect(
      computeGoalProgress({ goal: goal({ year: 2026, metric: 'parks' }), finished, now: NOW })
        ?.value,
    ).toBe(0);
    expect(
      computeGoalProgress({ goal: goal({ year: 2026, metric: 'summits' }), finished, now: NOW })
        ?.value,
    ).toBe(0);
  });

  it('marks upcoming and ended windows without pace', () => {
    const upcoming = computeGoalProgress({ goal: goal({ year: 2027 }), finished, now: NOW });
    expect(upcoming).toMatchObject({ phase: 'upcoming', elapsed: 0, pace: null });
    const ended = computeGoalProgress({ goal: goal({ year: 2025 }), finished, now: NOW });
    expect(ended).toMatchObject({ phase: 'ended', elapsed: 1, pace: null });
    expect(computeGoalProgress({ goal: goal({ year: null }), finished })).toBeNull();
  });

  it('counts list goals across the whole history', () => {
    const peakList = computeGoalProgress({
      goal: goal({
        kind: 'peakList',
        metric: 'summits',
        target: 3,
        startDate: '2026-01-01',
        peaks: [
          { name: 'Mount Hoffmann', latitude: 0, longitude: 0 },
          { name: 'Different name', latitude: 0, longitude: 0, osmId: 1 },
          { name: 'Shasta', latitude: 0, longitude: 0 },
        ],
      }),
      finished,
      parksAndPeaks: record,
      now: NOW,
    });
    expect(peakList).toMatchObject({ value: 2, phase: 'active', elapsed: 0, pace: null });

    const parkList = (parkCodes: string[] | null) =>
      computeGoalProgress({
        goal: goal({ kind: 'parkList', metric: 'parks', target: 2, parkCodes }),
        finished,
        parksAndPeaks: record,
        now: NOW,
      })?.value;
    expect(parkList(null)).toBe(2);
    expect(parkList(['SQR'])).toBe(1);
    expect(
      computeGoalProgress({
        goal: goal({ kind: 'parkList', metric: 'parks' }),
        finished,
        now: NOW,
      })?.value,
    ).toBe(0);
    expect(
      peaksClimbed({ peaks: [{ name: 'X', latitude: 0, longitude: 0 }], record: null }).size,
    ).toBe(0);
  });

  it('reads long-trail goals from the given progress only', () => {
    const longTrail = goal({ kind: 'longTrail', metric: 'distance', trailCode: 'PCT', target: 9 });
    expect(computeGoalProgress({ goal: longTrail, finished, now: NOW })).toBeNull();
    expect(
      computeGoalProgress({ goal: { ...longTrail, trailCode: null }, finished, now: NOW }),
    ).toBeNull();
    expect(
      computeGoalProgress({ goal: longTrail, finished, longTrailMeters: () => 5, now: NOW })?.value,
    ).toBe(5);
  });
});

describe('sortGoals', () => {
  it('orders by kind, custom end date, then creation', () => {
    const sorted = sortGoals([
      goal({ id: 'list', kind: 'parkList' }),
      goal({ id: 'late', kind: 'custom', endDate: '2026-12-01' }),
      goal({ id: 'early', kind: 'custom', endDate: '2026-06-01' }),
      goal({ id: 'a2', localCreatedAt: '2026-02-01T00:00:00.000Z' }),
      goal({ id: 'a1', localCreatedAt: '2026-01-01T00:00:00.000Z' }),
    ]);
    expect(sorted.map((g) => g.id)).toEqual(['a1', 'a2', 'early', 'late', 'list']);
  });
});

describe('peak suggestions', () => {
  const peak = (
    osmId: number,
    [latitude, elevationMeters]: [number, number | null],
  ): NearbyPeak => ({
    osmId,
    name: `Peak ${osmId}`,
    elevationMeters,
    latitude,
    longitude: 0,
  });

  it('puts peaks on the route first in route order, then the rest nearest first', () => {
    const route = [0, 0.01, 0.02, 0.03].map((latitude) => ({ latitude, longitude: 0 }));
    const ranked = rankPeaks({
      peaks: [peak(1, [0.03, 100]), peak(2, [0.0001, 100]), peak(3, [0.1, 50]), peak(4, [0.1, 90])],
      route,
      center: { latitude: 0, longitude: 0 },
    });
    expect(ranked.onRoute.map((p) => p.peak.osmId)).toEqual([2, 1]);
    expect(ranked.nearby.map((p) => p.peak.osmId)).toEqual([4, 3]);
  });

  it('ranks from the centre without a route', () => {
    const ranked = rankPeaks({
      peaks: [peak(1, [0.2, null]), peak(2, [0.1, null])],
      route: [],
      center: { latitude: 0, longitude: 0 },
    });
    expect(ranked.onRoute).toEqual([]);
    expect(ranked.nearby.map((p) => p.peak.osmId)).toEqual([2, 1]);
  });

  it('builds a snapped, clamped search box', () => {
    expect(peakSearchBox([])).toBeNull();
    expect(peakSearchBox([{ latitude: 37.5, longitude: -119.5 }])).toEqual({
      south: 37.49,
      north: 37.51,
      west: -119.51,
      east: -119.49,
    });
    const wide = peakSearchBox([
      { latitude: 30, longitude: -120 },
      { latitude: 40, longitude: -100 },
    ]);
    expect(wide && wide.north - wide.south).toBeLessThanOrEqual(1);
    expect(wide && wide.east - wide.west).toBeLessThanOrEqual(1.5);
  });
});
