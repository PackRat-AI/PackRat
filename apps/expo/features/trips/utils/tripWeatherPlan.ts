import { addDays, format, startOfDay } from 'date-fns';
import { parseLocalDate } from 'expo-app/lib/utils/dateUtils';
import { FORECAST_HORIZON_DAYS } from './tripConditions';

/**
 * What a trip's Weather section shows, decided from the trip's dates and the
 * destination's forecast. Product behaviour: docs/features/trip-weather.md
 * ("The forecast on a trip").
 */
export type TripWeatherPlan =
  /** No destination or no dates, or the trip is over: no section at all. */
  | { kind: 'hidden' }
  /** The trip starts after the last forecast day. */
  | { kind: 'beyondRange' }
  /**
   * The trip's days that have a forecast, from today onward once it has
   * started. `partial` when later trip days are still out of range.
   */
  | { kind: 'days'; dates: string[]; underWay: boolean; partial: boolean };

export interface WeatherPlanTrip {
  deleted?: boolean;
  location?: { latitude: number; longitude: number } | null;
  startDate?: string | null;
  endDate?: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dayRange(trip: WeatherPlanTrip): { start: Date; end: Date } | null {
  if (trip.deleted || !trip.location) return null;
  const start = parseLocalDate(trip.startDate ?? undefined);
  if (!start) return null;
  const end = parseLocalDate(trip.endDate ?? undefined) ?? start;
  return { start: startOfDay(start), end: startOfDay(end > start ? end : start) };
}

function dayString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/** Whether the section needs a forecast fetched at all; decided from the dates alone. */
export function needsTripForecast({ trip, now }: { trip: WeatherPlanTrip; now: Date }): boolean {
  const range = dayRange(trip);
  if (!range) return false;
  const today = startOfDay(now);
  return range.end >= today && range.start <= addDays(today, FORECAST_HORIZON_DAYS - 1);
}

export function tripWeatherPlan({
  trip,
  forecastDates,
  now,
}: {
  trip: WeatherPlanTrip;
  forecastDates: readonly string[];
  now: Date;
}): TripWeatherPlan {
  const range = dayRange(trip);
  if (!range) return { kind: 'hidden' };
  const today = startOfDay(now);
  if (range.end < today) return { kind: 'hidden' };
  if (range.start > addDays(today, FORECAST_HORIZON_DAYS - 1)) return { kind: 'beyondRange' };

  const underWay = range.start <= today;
  const first = dayString(range.start > today ? range.start : today);
  const last = dayString(range.end);
  const dates = forecastDates.filter((date) => date >= first && date <= last).sort();
  const lastCovered = dates[dates.length - 1];
  return { kind: 'days', dates, underWay, partial: !lastCovered || lastCovered < last };
}

/**
 * When the server watches a trip's destination: from 3 days before the start
 * until a day after the end. Mirrors
 * `packages/api/src/services/weatherMonitoring/tripDestinationWatch.ts`.
 */
export function tripWatchWindow(trip: WeatherPlanTrip): { opensAt: Date; closesAt: Date } | null {
  if (trip.deleted || !trip.location) return null;
  const start = parseLocalDate(trip.startDate ?? undefined);
  if (!start) return null;
  const end = parseLocalDate(trip.endDate ?? undefined) ?? start;
  return {
    opensAt: new Date(start.getTime() - 3 * DAY_MS),
    closesAt: new Date(end.getTime() + DAY_MS),
  };
}

/**
 * Trips inside their watch window, soonest first, whether or not their alerts
 * are on, so the watch list keeps a trip the user switched off.
 */
export function tripsInWatchWindow<T extends WeatherPlanTrip>({
  trips,
  now,
}: {
  trips: readonly T[];
  now: Date;
}): T[] {
  return trips
    .flatMap((trip) => {
      const window = tripWatchWindow(trip);
      return window && window.opensAt <= now && now <= window.closesAt ? [{ trip, window }] : [];
    })
    .sort((a, b) => a.window.opensAt.getTime() - b.window.opensAt.getTime())
    .map(({ trip }) => trip);
}
