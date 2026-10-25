import { describe, expect, it } from 'vitest';
import { encodePolyline } from '../polyline';
import {
  ALL_SCOPE,
  clipTrips,
  computeTotals,
  computeTripStats,
  dayFromString,
  dayToString,
  findComeback,
  finishedTrips,
  gearKey,
  isAllScope,
  type StatsPack,
  type StatsTrip,
  seasonOf,
} from '../tripStats';

const NOW = new Date(2026, 5, 15, 10); // 15 June 2026

let counter = 0;
function trip(overrides: Partial<StatsTrip> & { startDate: string }): StatsTrip {
  counter += 1;
  return { id: `t${counter}`, name: `Trip ${counter}`, ...overrides };
}

describe('dayFromString / dayToString', () => {
  it('reads the calendar day whatever the time part', () => {
    expect(dayFromString('2026-03-01T00:00:00.000Z')).toEqual(new Date(2026, 2, 1));
    expect(dayFromString('2026-03-01')).toEqual(new Date(2026, 2, 1));
    // An edited trip can hold a Date in the store; its UTC day is the picked day.
    expect(dayFromString(new Date('2026-03-01T00:00:00.000Z'))).toEqual(new Date(2026, 2, 1));
    expect(dayFromString(new Date(Number.NaN))).toBeNull();
  });

  it('rejects missing or malformed input', () => {
    expect(dayFromString(null)).toBeNull();
    expect(dayFromString(undefined)).toBeNull();
    expect(dayFromString('2026')).toBeNull();
    expect(dayFromString('not-a-date-x')).toBeNull();
  });

  it('writes a day as UTC midnight of the same date', () => {
    expect(dayToString(new Date(2026, 0, 5))).toBe('2026-01-05T00:00:00.000Z');
  });
});

describe('finishedTrips', () => {
  it('keeps only trips whose last day is before today, oldest first', () => {
    const trips = [
      trip({ startDate: '2026-06-10', endDate: '2026-06-12' }),
      trip({ startDate: '2026-06-14', endDate: '2026-06-15' }), // ends today
      trip({ startDate: '2026-01-02' }), // day trip
      trip({ startDate: '2026-05-01', endDate: '2026-05-03', excludedFromStats: true }),
      trip({ startDate: '2026-05-01', deleted: true }),
      { id: 'nodate', name: 'No date' },
    ];
    const finished = finishedTrips({ trips, now: NOW });
    expect(finished.map((f) => f.nights)).toEqual([0, 2]);
    expect(finished[0]?.start).toEqual(new Date(2026, 0, 2));
  });

  it('clamps an end before the start to the start', () => {
    const [finished] = finishedTrips({
      trips: [trip({ startDate: '2026-02-10', endDate: '2026-02-08' })],
      now: NOW,
    });
    expect(finished?.nights).toBe(0);
    expect(finished?.end).toEqual(new Date(2026, 1, 10));
  });
});

describe('computeTotals', () => {
  it('counts overlapping days once and places within a kilometre once', () => {
    const finished = finishedTrips({
      trips: [
        trip({
          startDate: '2026-04-01',
          endDate: '2026-04-03',
          location: { latitude: 37.7, longitude: -119.5 },
          log: { activities: ['hiking'], distanceMeters: 1000, elevationGainMeters: 200 },
        }),
        trip({
          startDate: '2026-04-02',
          endDate: '2026-04-04',
          location: { latitude: 37.7001, longitude: -119.5001 },
        }),
        trip({
          startDate: '2026-05-01',
          location: { latitude: 40, longitude: -105 },
          log: { activities: [], distanceMeters: 500 },
        }),
      ],
      now: NOW,
    });
    expect(computeTotals(finished)).toEqual({
      trips: 3,
      nights: 4,
      days: 5,
      places: 2,
      distance: 1500,
      elevationGain: 200,
    });
  });

  it('leaves distance and elevation null when nothing logged one', () => {
    const totals = computeTotals(
      finishedTrips({ trips: [trip({ startDate: '2026-01-01' })], now: NOW }),
    );
    expect(totals.distance).toBeNull();
    expect(totals.elevationGain).toBeNull();
  });
});

describe('clipTrips', () => {
  it('drops trips starting outside the window and clips ends to it', () => {
    const finished = finishedTrips({
      trips: [
        trip({ startDate: '2025-12-30', endDate: '2026-01-02' }),
        trip({ startDate: '2026-01-30', endDate: '2026-02-03' }),
      ],
      now: NOW,
    });
    const clipped = clipTrips({
      trips: finished,
      window: {
        start: new Date(2026, 0, 1),
        end: new Date(2026, 0, 31),
      },
    });
    expect(clipped).toHaveLength(1);
    expect(clipped[0]?.nights).toBe(1);
  });
});

describe('seasonOf', () => {
  it('uses meteorological seasons and flips them south of the equator', () => {
    expect([1, 4, 7, 10].map((m) => seasonOf({ month: m }))).toEqual([
      'winter',
      'spring',
      'summer',
      'autumn',
    ]);
    expect([1, 4, 7, 10].map((m) => seasonOf({ month: m, latitude: -40 }))).toEqual([
      'summer',
      'autumn',
      'winter',
      'spring',
    ]);
    expect(seasonOf({ month: 12, latitude: 10 })).toBe('winter');
  });
});

describe('gearKey', () => {
  it('keys catalog items by id and others by trimmed lowercase name', () => {
    expect(gearKey({ name: 'Tent', catalogItemId: 7 })).toBe('catalog:7');
    expect(gearKey({ name: '  Stove ' })).toBe('name:stove');
  });
});

describe('computeTripStats', () => {
  const route = encodePolyline([
    { latitude: 37.7, longitude: -119.5 },
    { latitude: 37.71, longitude: -119.51 },
  ]);
  const trips: StatsTrip[] = [
    trip({
      id: 'a',
      startDate: '2025-03-10',
      endDate: '2025-03-12',
      packId: 'p1',
      location: { latitude: 37.7, longitude: -119.5 },
      log: { activities: ['hiking', 'camping', 'hiking'], distanceMeters: 20_000, route },
    }),
    trip({
      id: 'b',
      startDate: '2025-06-01',
      endDate: '2025-06-05',
      packId: 'p1',
      log: { activities: ['backpacking'], distanceMeters: 50_000, route: 'bad' },
    }),
    trip({
      id: 'c',
      startDate: '2026-02-01',
      endDate: '2026-02-03',
      packId: 'p2',
      log: { activities: ['hiking'] },
    }),
    trip({ id: 'd', startDate: '2026-03-05', endDate: '2026-03-07', packId: 'gone' }),
  ];
  const packs: StatsPack[] = [
    {
      id: 'p1',
      name: 'Summer kit',
      baseWeight: 5000,
      items: [
        { name: 'Tent', catalogItemId: 1 },
        { name: 'Tent', catalogItemId: 1 },
        { name: 'Stove' },
        { name: 'Old', deleted: true },
      ],
    },
    { id: 'p2', name: 'Light', baseWeight: 0, items: [{ name: 'stove ' }] },
    { id: 'gone', name: 'Deleted', items: [{ name: 'X' }], deleted: true },
  ];

  it('aggregates the whole record', () => {
    const stats = computeTripStats({ trips, packs, now: NOW });
    expect(stats.hasTrips).toBe(true);
    expect(stats.availableYears).toEqual([2026, 2025]);
    expect(stats.availableActivities).toEqual(['hiking', 'backpacking', 'camping']);
    expect(stats.totals.trips).toBe(4);
    expect(stats.thisYear).toMatchObject({ trips: 2, nights: 4 });
    expect(stats.lastYearToDate).toMatchObject({ trips: 2, nights: 6 });
    expect(stats.longestByNights?.trip.id).toBe('b');
    expect(stats.longestByDistance?.trip.id).toBe('b');
    expect(stats.averageNights).toBe(2.5);
    expect(stats.averageDistance).toBe(35_000);
    expect(stats.activities.map((a) => [a.activity, a.trips])).toEqual([
      ['hiking', 2],
      ['backpacking', 1],
      ['camping', 1],
    ]);
    expect(stats.routes.map((r) => r.id)).toEqual(['a']);
    expect(stats.months).toHaveLength(12);
    expect(stats.months[0]?.month).toEqual(new Date(2025, 6, 1));
    expect(stats.months.find((m) => m.month.getMonth() === 1)?.nights).toBe(2);
    expect(stats.busiestMonth).toBe(3);
    expect(stats.busiestSeason).toBe('spring');
    expect(stats.topGear).toEqual([
      { id: 'name:stove', name: 'Stove', trips: 3 },
      { id: 'catalog:1', name: 'Tent', trips: 2 },
    ]);
    expect(stats.packWeights.map((w) => w.id)).toEqual(['a', 'b']);
  });

  it('narrows to a year and an activity and starts the months in January', () => {
    const stats = computeTripStats({
      trips,
      packs,
      scope: { year: 2025, activity: 'hiking' },
      now: NOW,
    });
    expect(stats.finished.map((f) => f.trip.id)).toEqual(['a']);
    expect(stats.allFinished).toHaveLength(4);
    expect(stats.months[0]?.month).toEqual(new Date(2025, 0, 1));
    expect(isAllScope(stats.scope)).toBe(false);
    expect(isAllScope(ALL_SCOPE)).toBe(true);
  });

  it('returns an empty record for no trips', () => {
    const stats = computeTripStats({ trips: [], packs: [] });
    expect(stats.hasTrips).toBe(false);
    expect(stats.lastYearToDate).toBeNull();
    expect(stats.averageNights).toBeNull();
    expect(stats.averageDistance).toBeNull();
    expect(stats.busiestMonth).toBeNull();
    expect(stats.busiestSeason).toBeNull();
    expect(stats.comeback).toBeNull();
  });

  it('breaks busiest-month ties by trips, then the earlier month', () => {
    const stats = computeTripStats({
      trips: [
        trip({ startDate: '2025-04-01' }),
        trip({ startDate: '2025-02-01' }),
        trip({ startDate: '2025-02-03' }),
        trip({ startDate: '2025-09-01' }),
        trip({ startDate: '2025-09-03' }),
      ],
      packs: [],
      now: NOW,
    });
    expect(stats.busiestMonth).toBe(2);
    expect(stats.busiestSeason).toBe('winter');
  });
});

describe('findComeback', () => {
  const before = [
    trip({ startDate: '2025-01-10', endDate: '2025-01-12' }),
    trip({ startDate: '2025-02-10', endDate: '2025-02-14' }),
  ];

  it('finds a recent return after three months away', () => {
    const finished = finishedTrips({
      trips: [
        ...before,
        trip({
          startDate: '2026-05-20',
          endDate: '2026-05-21',
          log: { activities: [], distanceMeters: 100 },
        }),
      ],
      now: NOW,
    });
    const comeback = findComeback({ finished, today: new Date(2026, 5, 15) });
    expect(comeback?.monthsAway).toBe(15);
    expect(comeback?.daysBack).toBe(26);
    expect(comeback?.before.trips).toBeCloseTo(2 / 12);
    expect(comeback?.now.trips).toBe(1);
    expect(comeback?.now.distance).toBe(100);
    expect(comeback?.before.distance).toBeNull();
  });

  it('retires after six months and needs a real break', () => {
    const old = finishedTrips({ trips: [...before, trip({ startDate: '2025-10-01' })], now: NOW });
    expect(findComeback({ finished: old, today: new Date(2026, 5, 15) })).toBeNull();
    const steady = finishedTrips({
      trips: [...before, trip({ startDate: '2025-03-01' })],
      now: NOW,
    });
    expect(findComeback({ finished: steady, today: new Date(2025, 3, 1) })).toBeNull();
    expect(
      findComeback({
        finished: finishedTrips({ trips: before.slice(0, 1), now: NOW }),
        today: NOW,
      }),
    ).toBeNull();
  });

  it('hides once the user is back to their old pace', () => {
    const finished = finishedTrips({
      trips: [
        trip({ startDate: '2025-06-01', endDate: '2025-06-02' }),
        trip({ startDate: '2026-04-01', endDate: '2026-04-05' }),
        trip({ startDate: '2026-05-01', endDate: '2026-05-05' }),
      ],
      now: NOW,
    });
    expect(findComeback({ finished, today: new Date(2026, 5, 15) })).toBeNull();
  });
});
