import type { TripSummit } from '@packrat/schemas/trips';
import { describe, expect, it } from 'vitest';
import type { GoalProgress } from '../goalProgress';
import type { Ascent, NationalPark, ParksAndPeaks } from '../parksAndPeaks';
import { PRIVATE_SPAN_METRES, shareMapRegion } from '../shareMap';
import { finishedTrips, type StatsTrip } from '../tripStats';
import { computeYearInReview, offeredReviewYear, reviewPages } from '../yearInReview';

const NOW = new Date(2027, 2, 1, 12);
const EMPTY_RECORD: ParksAndPeaks = { parks: [], ascents: [] };

function trip(fields: Partial<StatsTrip> & { id: string; startDate: string }): StatsTrip {
  return { name: `Trip ${fields.id}`, ...fields };
}

function review({
  trips,
  year = 2026,
  parksAndPeaks = EMPTY_RECORD,
  goals = [],
}: {
  trips: StatsTrip[];
  year?: number;
  parksAndPeaks?: ParksAndPeaks;
  goals?: GoalProgress[];
}) {
  return computeYearInReview({
    year,
    finished: finishedTrips({ trips, now: NOW }),
    parksAndPeaks,
    goals,
  });
}

const PARK: NationalPark = {
  code: 'TEST',
  name: 'Test Park',
  states: ['WA'],
  rings: [],
  minLatitude: 0,
  maxLatitude: 0,
  minLongitude: 0,
  maxLongitude: 0,
};

function ascent({
  name,
  date,
  elevation,
}: {
  name: string;
  date: Date;
  elevation?: number;
}): Ascent {
  const summit: TripSummit = { name, latitude: 46, longitude: -121, elevationMeters: elevation };
  return { id: `${name}-${date.getTime()}`, summit, date, tripId: null, tripName: null };
}

function goal({
  id,
  kind,
  year,
  end,
  complete,
}: {
  id: string;
  kind: GoalProgress['goal']['kind'];
  year?: number;
  end: Date;
  complete: boolean;
}): GoalProgress {
  return {
    goal: { id, kind, metric: 'trips', target: 2, year },
    start: new Date(end.getFullYear(), 0, 1),
    end,
    phase: 'ended',
    value: complete ? 2 : 1,
    elapsed: 1,
    pace: null,
  };
}

describe('offeredReviewYear', () => {
  it('offers the closing year in December and the year gone in January, never otherwise', () => {
    expect(offeredReviewYear({ now: new Date(2026, 11, 1) })).toBe(2026);
    expect(offeredReviewYear({ now: new Date(2027, 0, 31) })).toBe(2026);
    expect(offeredReviewYear({ now: new Date(2026, 9, 7) })).toBeNull();
    expect(offeredReviewYear({ now: new Date(2026, 9, 7), force: true })).toBe(2026);
  });
});

describe('computeYearInReview', () => {
  it('is null for a year with no finished trips', () => {
    expect(review({ trips: [trip({ id: 'a', startDate: '2025-06-01' })] })).toBeNull();
  });

  it('clips a trip crossing New Year and counts only the year it started in', () => {
    const trips = [
      trip({ id: 'a', startDate: '2026-12-29', endDate: '2027-01-02' }),
      trip({ id: 'b', startDate: '2025-12-30', endDate: '2026-01-01' }),
    ];
    const result = review({ trips });
    expect(result?.totals.trips).toBe(1);
    expect(result?.totals.nights).toBe(2);
    expect(review({ trips, year: 2025 })?.totals.nights).toBe(1);
  });

  it('finds the busiest month by nights and keeps all twelve months', () => {
    const result = review({
      trips: [
        trip({ id: 'a', startDate: '2026-03-01' }),
        trip({ id: 'b', startDate: '2026-03-10' }),
        trip({ id: 'c', startDate: '2026-07-01', endDate: '2026-07-04' }),
      ],
    });
    expect(result?.months).toHaveLength(12);
    expect(result?.busiestMonth?.month.getMonth()).toBe(6);
    expect(result?.months[2]?.trips).toBe(2);
  });

  it('picks the longest by nights and the farthest by logged distance', () => {
    const result = review({
      trips: [
        trip({ id: 'long', startDate: '2026-05-01', endDate: '2026-05-06' }),
        trip({
          id: 'far',
          startDate: '2026-06-01',
          log: { activities: [], distanceMeters: 30_000 },
        }),
      ],
    });
    expect(result?.longestTrip?.trip.id).toBe('long');
    expect(result?.farthestTrip?.trip.id).toBe('far');
    expect(result && reviewPages(result)).toContain('longestTrip');
  });

  it('counts a place as new only when it is over a kilometre from every earlier trip', () => {
    const result = review({
      trips: [
        trip({ id: 'old', startDate: '2025-05-01', location: { latitude: 46, longitude: -121 } }),
        trip({
          id: 'same',
          startDate: '2026-05-01',
          location: { latitude: 46.001, longitude: -121 },
        }),
        trip({ id: 'new', startDate: '2026-06-01', location: { latitude: 47, longitude: -121 } }),
      ],
    });
    expect(result?.newPlaces).toBe(1);
  });

  it('lists a park first visited this year as new, and not one visited before', () => {
    const trips = [trip({ id: 'a', startDate: '2026-05-01' })];
    const visit = (date: Date) => ({ id: 'v', date, tripId: null, tripName: null });
    const first = review({
      trips,
      parksAndPeaks: {
        parks: [{ park: PARK, visits: [visit(new Date(2026, 4, 1))] }],
        ascents: [],
      },
    });
    expect(first?.newParks.map((park) => park.code)).toEqual(['TEST']);
    const returning = review({
      trips,
      parksAndPeaks: {
        parks: [{ park: PARK, visits: [visit(new Date(2024, 4, 1)), visit(new Date(2026, 4, 1))] }],
        ascents: [],
      },
    });
    expect(returning?.newParks).toEqual([]);
    expect(returning && reviewPages(returning)).not.toContain('newPlaces');
  });

  it('counts distinct summits this year and the highest of them', () => {
    const result = review({
      trips: [trip({ id: 'a', startDate: '2026-05-01' })],
      parksAndPeaks: {
        parks: [],
        ascents: [
          ascent({ name: 'Mount Rainier', date: new Date(2026, 7, 1), elevation: 4392 }),
          ascent({ name: 'Mount Si', date: new Date(2026, 5, 1), elevation: 1270 }),
          ascent({ name: 'Mount Si', date: new Date(2026, 4, 1), elevation: 1270 }),
          ascent({ name: 'Mount Baker', date: new Date(2025, 4, 1), elevation: 3286 }),
        ],
      },
    });
    expect(result?.peakCount).toBe(2);
    expect(result?.highest?.summit.name).toBe('Mount Rainier');
    expect(result?.summits).toHaveLength(3);
  });

  it("counts this year's annual goals and dated goals ending this year, only when met", () => {
    const result = review({
      trips: [trip({ id: 'a', startDate: '2026-05-01' })],
      goals: [
        goal({
          id: 'met',
          kind: 'annual',
          year: 2026,
          end: new Date(2026, 11, 31),
          complete: true,
        }),
        goal({
          id: 'missed',
          kind: 'annual',
          year: 2026,
          end: new Date(2026, 11, 31),
          complete: false,
        }),
        goal({
          id: 'lastYear',
          kind: 'annual',
          year: 2025,
          end: new Date(2025, 11, 31),
          complete: true,
        }),
        goal({ id: 'nextYear', kind: 'custom', end: new Date(2027, 1, 1), complete: true }),
      ],
    });
    expect(result?.goalsMet.map((item) => item.goal.id)).toEqual(['met']);
    expect(result && reviewPages(result)).toContain('goals');
  });

  it('leaves out pages with nothing to say', () => {
    const result = review({ trips: [trip({ id: 'a', startDate: '2026-05-01' })] });
    expect(result && reviewPages(result)).toEqual(['intro', 'totals', 'summary']);
  });
});

describe('shareMapRegion', () => {
  it('holds a lone point at the private span, centred, widened to the frame', () => {
    const region = shareMapRegion({
      points: [{ latitude: 0, longitude: 10 }],
      aspect: 2,
      minSpanMetres: PRIVATE_SPAN_METRES,
    });
    expect(region?.latitude).toBe(0);
    expect(region?.longitude).toBe(10);
    expect((region?.latitudeDelta ?? 0) * 111_320).toBeCloseTo(PRIVATE_SPAN_METRES, 0);
    expect((region?.longitudeDelta ?? 0) / (region?.latitudeDelta ?? 1)).toBeCloseTo(2, 5);
  });

  it('zooms in close to the points when the user allows it, and is null with no points', () => {
    const region = shareMapRegion({
      points: [
        { latitude: 46.5, longitude: -121.2 },
        { latitude: 46.6, longitude: -121.3 },
      ],
      aspect: 1,
      minSpanMetres: 0,
    });
    expect((region?.latitudeDelta ?? 0) * 111_320).toBeLessThan(PRIVATE_SPAN_METRES / 2);
    expect(shareMapRegion({ points: [], aspect: 1, minSpanMetres: 0 })).toBeNull();
  });
});
