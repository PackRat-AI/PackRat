import { describe, expect, it } from 'vitest';
import { activitiesSummary, monthsSummary, weightSummary } from '../chartSummaries';

const month = ({ m, trips, nights }: { m: number; trips: number; nights: number }) => ({
  month: new Date(2026, m, 1),
  trips,
  nights,
});

describe('chart summaries', () => {
  it('totals the months and names the busiest, first on a tie', () => {
    const months = [
      month({ m: 0, trips: 1, nights: 2 }),
      month({ m: 1, trips: 2, nights: 5 }),
      month({ m: 2, trips: 2, nights: 1 }),
      month({ m: 3, trips: 0, nights: 0 }),
    ];
    expect(monthsSummary({ months, metric: 'nights' })).toEqual({
      total: 8,
      peak: { month: new Date(2026, 1, 1), value: 5 },
    });
    expect(monthsSummary({ months, metric: 'trips' }).peak?.month).toEqual(new Date(2026, 1, 1));
    expect(
      monthsSummary({ months: [month({ m: 0, trips: 0, nights: 0 })], metric: 'trips' }),
    ).toEqual({
      total: 0,
      peak: null,
    });
  });

  it('counts activities and names the one with most trips', () => {
    const buckets = [
      { activity: 'hiking' as const, trips: 3, nights: 2, distance: 0 },
      { activity: 'paddling' as const, trips: 5, nights: 0, distance: 0 },
    ];
    expect(activitiesSummary(buckets)).toEqual({ count: 2, top: buckets[1] });
    expect(activitiesSummary([])).toEqual({ count: 0, top: null });
  });

  it('gives the first and last base weight once there are two', () => {
    const point = ({ id, grams }: { id: string; grams: number }) => ({
      id,
      grams,
      date: new Date(2026, 0, 1),
      packName: id,
    });
    expect(
      weightSummary([
        point({ id: 'a', grams: 9_000 }),
        point({ id: 'b', grams: 7_000 }),
        point({ id: 'c', grams: 6_500 }),
      ]),
    ).toMatchObject({
      count: 3,
      first: { id: 'a' },
      last: { id: 'c' },
    });
    expect(weightSummary([point({ id: 'a', grams: 9_000 })])).toEqual({
      count: 1,
      first: null,
      last: null,
    });
  });
});
