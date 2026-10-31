import type { WeatherAPIForecastResponse, WeatherAttribution } from '@packrat/schemas/weather';
import { differenceInCalendarDays, format } from 'date-fns';
import { parseLocalDate } from 'expo-app/lib/utils/dateUtils';
import type { ReminderTrip } from './tripReminderPlanner';

/**
 * The weather at a trip's destination across the trip's own days, boiled down
 * to what changes the pack. Built from the 10-day forecast, so it only exists
 * once the trip is inside that window. Product behaviour:
 * docs/features/pre-trip-reminders.md ("Conditions at the destination").
 */
export interface TripConditions {
  tripId: string;
  /** The destination and dates this was built for; a change to either makes it stale. */
  sourceKey: string;
  /** Epoch ms. */
  fetchedAt: number;
  /** Trip days the forecast covers, out of `tripDays`. */
  coveredDays: number;
  tripDays: number;
  lowF: number;
  highF: number;
  lowC: number;
  highC: number;
  maxChanceOfRain: number;
  maxChanceOfSnow: number;
  conditionText: string | null;
  alerts: { id: string; event: string; severity: string }[];
  /** Credit owed for the forecast's source; shown with it in the readiness summary. */
  attribution: WeatherAttribution | null;
}

export interface ConditionsTrip extends ReminderTrip {
  location?: { latitude: number; longitude: number } | null;
}

/** Forecast thresholds that change what to bring. */
const FREEZING_F = 32;
const NEAR_FREEZING_F = 38;
const HOT_F = 90;
const LIKELY_CHANCE = 50;
const SNOW_CHANCE = 30;

/** Forecasts reach 10 days out; there is nothing to fetch before that. */
export const FORECAST_HORIZON_DAYS = 10;
/** A forecast younger than this is reused rather than refetched. */
export const CONDITIONS_MAX_AGE_MS = 60 * 60 * 1000;

export function conditionsSourceKey(trip: ConditionsTrip): string {
  const location = trip.location ? `${trip.location.latitude},${trip.location.longitude}` : '';
  return `${location}|${trip.startDate ?? ''}|${trip.endDate ?? ''}`;
}

/** Trips worth a forecast: dated, located, and starting within the horizon but not yet over. */
export function needsForecast({ trip, now }: { trip: ConditionsTrip; now: Date }): boolean {
  if (trip.deleted || !trip.location) return false;
  const start = parseLocalDate(trip.startDate ?? undefined);
  if (!start) return false;
  const days = differenceInCalendarDays(start, now);
  return days >= 0 && days <= FORECAST_HORIZON_DAYS;
}

/** Whether a stored summary can be reused instead of refetching. */
export function isConditionsFresh({
  existing,
  trip,
  now,
}: {
  existing: TripConditions | undefined;
  trip: ConditionsTrip;
  now: Date;
}): boolean {
  return (
    !!existing &&
    existing.sourceKey === conditionsSourceKey(trip) &&
    now.getTime() - existing.fetchedAt < CONDITIONS_MAX_AGE_MS
  );
}

/** Summarises `forecast` over the trip's days; null when no forecast day falls inside the trip yet. */
export function makeTripConditions({
  trip,
  forecast,
  now,
}: {
  trip: ConditionsTrip;
  forecast: Pick<WeatherAPIForecastResponse, 'forecast' | 'alerts' | 'attribution'>;
  now: Date;
}): TripConditions | null {
  const start = parseLocalDate(trip.startDate ?? undefined);
  if (!start) return null;
  const parsedEnd = parseLocalDate(trip.endDate ?? undefined);
  const end = parsedEnd && parsedEnd > start ? parsedEnd : start;
  const firstDay = format(start, 'yyyy-MM-dd');
  const lastDay = format(end, 'yyyy-MM-dd');
  const daily = forecast.forecast.forecastday
    .filter((day) => day.date >= firstDay && day.date <= lastDay)
    .map((day) => day.day);
  if (daily.length === 0) return null;

  // The provider repeats one alert per affected zone; keep one per event.
  const seenEvents = new Set<string>();
  const alerts = (forecast.alerts?.alert ?? []).flatMap((alert, index) => {
    const event = alert.event || alert.headline;
    if (!event || seenEvents.has(event.toLowerCase())) return [];
    seenEvents.add(event.toLowerCase());
    return [{ id: `${index}-${event}`, event, severity: alert.severity }];
  });

  return {
    tripId: trip.id,
    sourceKey: conditionsSourceKey(trip),
    fetchedAt: now.getTime(),
    coveredDays: daily.length,
    tripDays: differenceInCalendarDays(end, start) + 1,
    lowF: Math.min(...daily.map((d) => d.mintemp_f)),
    highF: Math.max(...daily.map((d) => d.maxtemp_f)),
    lowC: Math.min(...daily.map((d) => d.mintemp_c)),
    highC: Math.max(...daily.map((d) => d.maxtemp_c)),
    maxChanceOfRain: Math.max(...daily.map((d) => d.daily_chance_of_rain ?? 0)),
    maxChanceOfSnow: Math.max(...daily.map((d) => d.daily_chance_of_snow ?? 0)),
    conditionText: daily[0]?.condition.text ?? null,
    alerts,
    attribution: forecast.attribution ?? null,
  };
}

// ── Copy ─────────────────────────────────────────────────────────────────────

/** "Highs 68°, lows 34°" in the user's unit. */
export function temperatureSummary({
  conditions,
  celsius,
}: {
  conditions: TripConditions;
  celsius: boolean;
}): string {
  const high = celsius ? conditions.highC : conditions.highF;
  const low = celsius ? conditions.lowC : conditions.lowF;
  return `Highs ${Math.round(high)}°, lows ${Math.round(low)}°`;
}

/** What the forecast means for the pack, most consequential first; empty when it asks nothing. */
export function packAdvice({
  conditions,
  celsius,
}: {
  conditions: TripConditions;
  celsius: boolean;
}): string[] {
  const advice: string[] = [];
  if (conditions.maxChanceOfSnow >= SNOW_CHANCE) {
    advice.push('Snow possible — pack warm layers and traction.');
  } else if (conditions.lowF <= FREEZING_F) {
    advice.push('Lows below freezing — pack your warm layers.');
  } else if (conditions.lowF <= NEAR_FREEZING_F) {
    advice.push('Lows near freezing — pack your warm layers.');
  }
  if (conditions.maxChanceOfRain >= LIKELY_CHANCE) {
    advice.push('Rain likely — pack your rain gear.');
  }
  if (conditions.highF >= HOT_F) {
    const high = Math.round(celsius ? conditions.highC : conditions.highF);
    advice.push(`Highs near ${high}° — bring extra water and sun cover.`);
  }
  return advice;
}

/** One line for a reminder: an active hazard outranks pack advice. */
export function reminderLine({
  conditions,
  celsius,
}: {
  conditions: TripConditions;
  celsius: boolean;
}): string | null {
  const [alert] = conditions.alerts;
  if (alert) return `Weather alert at the destination: ${alert.event}.`;
  return packAdvice({ conditions, celsius })[0] ?? null;
}
