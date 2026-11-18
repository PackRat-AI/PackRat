import { describe, expect, it } from 'vitest';
import {
  needsTripForecast,
  tripsInWatchWindow,
  tripWeatherPlan,
  type WeatherPlanTrip,
} from '../tripWeatherPlan';

const location = { latitude: 46.85, longitude: -121.76 };
const trip = (overrides: Partial<WeatherPlanTrip> = {}): WeatherPlanTrip => ({
  location,
  startDate: '2026-10-20',
  endDate: '2026-10-22',
  ...overrides,
});
const at = (date: string, time = '12:00') => new Date(`${date}T${time}:00`);
const tenDays = (from: number) =>
  Array.from({ length: 10 }, (_, i) => `2026-10-${String(from + i).padStart(2, '0')}`);

describe('tripWeatherPlan', () => {
  it('hides the section without a location or a start date', () => {
    const now = at('2026-10-18');
    expect(tripWeatherPlan({ trip: trip({ location: null }), forecastDates: [], now })).toEqual({
      kind: 'hidden',
    });
    expect(tripWeatherPlan({ trip: trip({ startDate: null }), forecastDates: [], now })).toEqual({
      kind: 'hidden',
    });
  });

  it('hides a trip that is over', () => {
    const plan = tripWeatherPlan({ trip: trip(), forecastDates: [], now: at('2026-10-23') });
    expect(plan).toEqual({ kind: 'hidden' });
  });

  it('says beyond range when the trip starts after the last forecast day', () => {
    const plan = tripWeatherPlan({ trip: trip(), forecastDates: [], now: at('2026-10-10') });
    expect(plan).toEqual({ kind: 'beyondRange' });
  });

  it("lists only the trip's own days when the whole trip is in range", () => {
    const plan = tripWeatherPlan({
      trip: trip(),
      forecastDates: tenDays(15),
      now: at('2026-10-15'),
    });
    expect(plan).toEqual({
      kind: 'days',
      dates: ['2026-10-20', '2026-10-21', '2026-10-22'],
      underWay: false,
      partial: false,
    });
  });

  it('marks a trip running past the forecast as partial', () => {
    const plan = tripWeatherPlan({
      trip: trip({ endDate: '2026-10-25' }),
      forecastDates: tenDays(11),
      now: at('2026-10-11'),
    });
    expect(plan).toEqual({
      kind: 'days',
      dates: ['2026-10-20'],
      underWay: false,
      partial: true,
    });
  });

  it('starts a trip under way at today', () => {
    const plan = tripWeatherPlan({
      trip: trip(),
      forecastDates: tenDays(21),
      now: at('2026-10-21'),
    });
    expect(plan).toEqual({
      kind: 'days',
      dates: ['2026-10-21', '2026-10-22'],
      underWay: true,
      partial: false,
    });
  });
});

describe('needsTripForecast', () => {
  it('fetches only for trips inside the forecast window and not over', () => {
    expect(needsTripForecast({ trip: trip(), now: at('2026-10-11') })).toBe(true);
    expect(needsTripForecast({ trip: trip(), now: at('2026-10-21') })).toBe(true);
    expect(needsTripForecast({ trip: trip(), now: at('2026-10-10') })).toBe(false);
    expect(needsTripForecast({ trip: trip(), now: at('2026-10-23') })).toBe(false);
    expect(needsTripForecast({ trip: trip({ deleted: true }), now: at('2026-10-21') })).toBe(false);
  });
});

describe('tripsInWatchWindow', () => {
  it('opens 3 days before the start and closes a day after the end', () => {
    const t = trip();
    expect(tripsInWatchWindow({ trips: [t], now: at('2026-10-16', '23:00') })).toEqual([]);
    expect(tripsInWatchWindow({ trips: [t], now: at('2026-10-17', '00:00') })).toEqual([t]);
    expect(tripsInWatchWindow({ trips: [t], now: at('2026-10-23', '00:00') })).toEqual([t]);
    expect(tripsInWatchWindow({ trips: [t], now: at('2026-10-23', '00:01') })).toEqual([]);
  });

  it('keeps a trip whose alerts are off and drops deleted or unlocated trips', () => {
    const off = { ...trip(), weatherAlerts: false };
    const deleted = trip({ deleted: true });
    const unlocated = trip({ location: null });
    expect(tripsInWatchWindow({ trips: [off, deleted, unlocated], now: at('2026-10-20') })).toEqual(
      [off],
    );
  });

  it('orders trips soonest first', () => {
    const later = trip({ startDate: '2026-10-21', endDate: '2026-10-21' });
    const sooner = trip({ startDate: '2026-10-19', endDate: '2026-10-19' });
    expect(tripsInWatchWindow({ trips: [later, sooner], now: at('2026-10-19') })).toEqual([
      sooner,
      later,
    ]);
  });
});
