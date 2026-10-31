import type { WeatherAPIForecastResponse } from '@packrat/schemas/weather';
import { describe, expect, it } from 'vitest';
import {
  CONDITIONS_MAX_AGE_MS,
  type ConditionsTrip,
  conditionsSourceKey,
  isConditionsFresh,
  makeTripConditions,
  needsForecast,
  packAdvice,
  reminderLine,
  type TripConditions,
  temperatureSummary,
} from '../tripConditions';

type Forecast = Pick<WeatherAPIForecastResponse, 'forecast' | 'alerts' | 'attribution'>;
type ForecastDay = Forecast['forecast']['forecastday'][number];
type Alert = NonNullable<NonNullable<Forecast['alerts']>['alert']>[number];

const trip = (overrides: Partial<ConditionsTrip> = {}): ConditionsTrip => ({
  id: 't1',
  name: 'Rainier',
  startDate: '2026-10-20',
  endDate: '2026-10-22',
  location: { latitude: 46.85, longitude: -121.76 },
  ...overrides,
});

const day = (
  date: string,
  {
    lowF,
    highF,
    rain = 0,
    snow = 0,
  }: { lowF: number; highF: number; rain?: number; snow?: number },
): ForecastDay =>
  // safe-cast: the summary reads only these fields; the rest of a provider day is irrelevant here
  ({
    date,
    day: {
      mintemp_f: lowF,
      maxtemp_f: highF,
      mintemp_c: Math.round(((lowF - 32) * 5) / 9),
      maxtemp_c: Math.round(((highF - 32) * 5) / 9),
      daily_chance_of_rain: rain,
      daily_chance_of_snow: snow,
      condition: { text: 'Sunny' },
    },
  }) as ForecastDay;

const alert = (event: string, headline = event): Alert =>
  // safe-cast: the summary reads only these fields
  ({ event, headline, severity: 'Moderate' }) as Alert;

const now = new Date('2026-10-15T12:00:00');

const forecast = (days: ForecastDay[], alerts: Alert[] = []): Forecast => ({
  forecast: { forecastday: days },
  alerts: { alert: alerts },
});

describe('makeTripConditions', () => {
  it('summarises only the trip days and dedupes alerts by event', () => {
    const conditions = makeTripConditions({
      trip: trip(),
      forecast: forecast(
        [
          day('2026-10-19', { lowF: 10, highF: 100 }),
          day('2026-10-20', { lowF: 40, highF: 60, rain: 30 }),
          day('2026-10-21', { lowF: 35, highF: 65, rain: 70, snow: 5 }),
        ],
        [alert('Flood Watch'), alert('flood watch'), alert('', 'Wind Advisory'), alert('', '')],
      ),
      now,
    });
    expect(conditions).toMatchObject({
      tripId: 't1',
      sourceKey: '46.85,-121.76|2026-10-20|2026-10-22',
      fetchedAt: now.getTime(),
      coveredDays: 2,
      tripDays: 3,
      lowF: 35,
      highF: 65,
      maxChanceOfRain: 70,
      maxChanceOfSnow: 5,
      conditionText: 'Sunny',
      attribution: null,
    });
    expect(conditions?.alerts.map((a) => a.event)).toEqual(['Flood Watch', 'Wind Advisory']);
  });

  it('treats a missing or earlier end date as a one-day trip', () => {
    const conditions = makeTripConditions({
      trip: trip({ endDate: '2026-10-01' }),
      forecast: { forecast: { forecastday: [day('2026-10-20', { lowF: 40, highF: 60 })] } },
      now,
    });
    expect(conditions).toMatchObject({ tripDays: 1, coveredDays: 1, alerts: [] });
  });

  it('returns null without a start date or before the forecast reaches the trip', () => {
    const days = forecast([day('2026-10-15', { lowF: 40, highF: 60 })]);
    expect(makeTripConditions({ trip: trip({ startDate: null }), forecast: days, now })).toBeNull();
    expect(makeTripConditions({ trip: trip(), forecast: days, now })).toBeNull();
  });
});

describe('needsForecast', () => {
  it('wants trips that are located and start within ten days', () => {
    expect(needsForecast({ trip: trip(), now })).toBe(true);
    expect(needsForecast({ trip: trip({ startDate: '2026-10-26' }), now })).toBe(false);
    expect(needsForecast({ trip: trip({ startDate: '2026-10-14' }), now })).toBe(false);
    expect(needsForecast({ trip: trip({ location: null }), now })).toBe(false);
    expect(needsForecast({ trip: trip({ deleted: true }), now })).toBe(false);
    expect(needsForecast({ trip: trip({ startDate: null }), now })).toBe(false);
  });
});

describe('isConditionsFresh', () => {
  const existing = makeTripConditions({
    trip: trip(),
    forecast: forecast([day('2026-10-20', { lowF: 40, highF: 60 })]),
    now,
  }) as TripConditions;

  it('reuses a summary for the same place and dates within the hour', () => {
    expect(isConditionsFresh({ existing, trip: trip(), now })).toBe(true);
    const later = new Date(now.getTime() + CONDITIONS_MAX_AGE_MS);
    expect(isConditionsFresh({ existing, trip: trip(), now: later })).toBe(false);
    expect(isConditionsFresh({ existing, trip: trip({ endDate: '2026-10-23' }), now })).toBe(false);
    expect(isConditionsFresh({ existing: undefined, trip: trip(), now })).toBe(false);
  });
});

describe('conditionsSourceKey', () => {
  it('handles a trip with no place or dates', () => {
    expect(
      conditionsSourceKey({ id: 'x', name: 'x', location: null, startDate: null, endDate: null }),
    ).toBe('||');
  });
});

describe('copy', () => {
  const base: TripConditions = {
    tripId: 't1',
    sourceKey: '',
    fetchedAt: 0,
    coveredDays: 1,
    tripDays: 1,
    lowF: 50,
    highF: 70,
    lowC: 10,
    highC: 21,
    maxChanceOfRain: 0,
    maxChanceOfSnow: 0,
    conditionText: null,
    alerts: [],
    attribution: null,
  };

  it('summarises temperatures in the chosen unit', () => {
    expect(temperatureSummary({ conditions: base, celsius: false })).toBe('Highs 70°, lows 50°');
    expect(temperatureSummary({ conditions: base, celsius: true })).toBe('Highs 21°, lows 10°');
  });

  it('turns cold, wet and hot forecasts into pack advice, most consequential first', () => {
    expect(packAdvice({ conditions: base, celsius: false })).toEqual([]);
    expect(packAdvice({ conditions: { ...base, maxChanceOfSnow: 40 }, celsius: false })).toEqual([
      'Snow possible — pack warm layers and traction.',
    ]);
    expect(packAdvice({ conditions: { ...base, lowF: 30 }, celsius: false })).toEqual([
      'Lows below freezing — pack your warm layers.',
    ]);
    expect(
      packAdvice({
        conditions: { ...base, lowF: 36, maxChanceOfRain: 60, highF: 95, highC: 35 },
        celsius: true,
      }),
    ).toEqual([
      'Lows near freezing — pack your warm layers.',
      'Rain likely — pack your rain gear.',
      'Highs near 35° — bring extra water and sun cover.',
    ]);
    expect(packAdvice({ conditions: { ...base, highF: 95 }, celsius: false })).toEqual([
      'Highs near 95° — bring extra water and sun cover.',
    ]);
  });

  it('leads a reminder with an active alert, then pack advice, else nothing', () => {
    expect(
      reminderLine({
        conditions: { ...base, alerts: [{ id: '1', event: 'Flood Watch', severity: 'Moderate' }] },
        celsius: false,
      }),
    ).toBe('Weather alert at the destination: Flood Watch.');
    expect(reminderLine({ conditions: { ...base, maxChanceOfRain: 80 }, celsius: false })).toBe(
      'Rain likely — pack your rain gear.',
    );
    expect(reminderLine({ conditions: base, celsius: false })).toBeNull();
  });
});
