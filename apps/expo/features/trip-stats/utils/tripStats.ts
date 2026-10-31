import type { TripActivity } from '@packrat/schemas/trips';
import { first, sort, sum } from '@packrat/utils';
import {
  addDays,
  addMonths,
  addYears,
  differenceInCalendarDays,
  differenceInMonths,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import type { Trip } from 'expo-app/features/trips/types';
import { type Coordinate, decodePolyline, distanceMeters } from './polyline';

/**
 * The record a user's finished trips add up to. Pure aggregation over trips and the packs linked
 * to them, ported from the Swift app's `TripStats` so both platforms read the same numbers. See
 * `docs/features/trip-stats.md`.
 *
 * Dates, a location and a pack count for every trip. Distance, elevation, activity and route
 * come from the trip's log and count only for the trips that hold them; nothing here estimates a
 * missing figure. Trips the user left out of stats count toward nothing.
 */

export const TRIP_ACTIVITIES = Object.freeze([
  'hiking',
  'backpacking',
  'camping',
  'climbing',
  'mountaineering',
  'paddling',
  'skiing',
  'biking',
  'other',
] as const satisfies readonly TripActivity[]);

/** The fields of a trip the record reads. */
export type StatsTrip = Pick<
  Trip,
  'id' | 'name' | 'startDate' | 'endDate' | 'location' | 'packId' | 'log' | 'excludedFromStats'
> & { deleted?: boolean };

export interface StatsPackItem {
  name: string;
  catalogItemId?: number | null;
  deleted?: boolean;
}

export interface StatsPack {
  id: string;
  name: string;
  baseWeight?: number | null;
  items: readonly StatsPackItem[];
  deleted?: boolean;
}

/** First and last day, both counted. */
export interface DayWindow {
  start: Date;
  end: Date;
}

export interface FinishedTrip {
  trip: StatsTrip;
  /** Local midnight of the first day. */
  start: Date;
  /** Local midnight of the last day, never before `start`. */
  end: Date;
  /** Nights between the start and end day. A day trip has none. */
  nights: number;
}

export interface Totals {
  trips: number;
  nights: number;
  days: number;
  places: number;
  /** Metres, summed over the trips that logged one; null when none did. */
  distance: number | null;
  elevationGain: number | null;
}

export interface ActivityBucket {
  activity: TripActivity;
  trips: number;
  nights: number;
  distance: number;
}

export interface MonthBucket {
  /** First day of the month. */
  month: Date;
  trips: number;
  nights: number;
}

export interface GearCount {
  id: string;
  name: string;
  trips: number;
}

export interface WeightPoint {
  id: string;
  date: Date;
  grams: number;
  packName: string;
}

export interface Route {
  id: string;
  name: string;
  coordinates: Coordinate[];
}

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/** Narrows the record to one year, one activity, or both. */
export interface Scope {
  year: number | null;
  activity: TripActivity | null;
}

export const ALL_SCOPE: Scope = Object.freeze({ year: null, activity: null });

export function isAllScope(scope: Scope): boolean {
  return scope.year == null && scope.activity == null;
}

export interface Comeback {
  /** The first trip after the break. */
  trip: FinishedTrip;
  monthsAway: number;
  now: Pace;
  before: Pace;
  daysBack: number;
}

/** Per-month figures for one stretch. */
export interface Pace {
  trips: number;
  nights: number;
  /** Metres; null when no trip in the stretch logged a distance. */
  distance: number | null;
}

export interface TripStatsRecord {
  scope: Scope;
  /** Years holding a finished trip, newest first, whatever the scope. */
  availableYears: number[];
  /** Activities logged on any finished trip, in menu order, whatever the scope. */
  availableActivities: TripActivity[];
  /** True when there are finished trips at all, before the scope narrows them. */
  hasTrips: boolean;
  /** Finished trips inside the scope, oldest first. */
  finished: FinishedTrip[];
  /** Every finished trip, whatever the scope, oldest first. */
  allFinished: FinishedTrip[];
  totals: Totals;
  thisYear: Totals;
  /** The same 1 January → today stretch of last year; null for a first-year user. */
  lastYearToDate: Totals | null;
  longestByNights: FinishedTrip | null;
  longestByDistance: FinishedTrip | null;
  averageNights: number | null;
  /** Over the trips that logged a distance only. */
  averageDistance: number | null;
  /** Trips per activity, busiest first. A trip with two activities counts in both. */
  activities: ActivityBucket[];
  routes: Route[];
  /** The last twelve months, or the scoped year's twelve, oldest first, including empty ones. */
  months: MonthBucket[];
  /** 1–12. Busiest calendar month across the history in scope, by nights then trips. */
  busiestMonth: number | null;
  busiestSeason: Season | null;
  topGear: GearCount[];
  packWeights: WeightPoint[];
  comeback: Comeback | null;
}

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * A trip's calendar day. Dates go over the wire as `YYYY-MM-DD` or as that day at UTC midnight;
 * either way the first ten characters are the day the user picked, in any time zone. The trips
 * store can also hold a `Date` after an edit, typed as a string; its UTC day is the same day.
 */
export function dayFromString(value?: string | Date | null): Date | null {
  if (value instanceof Date && Number.isNaN(value.getTime())) return null;
  const text = value instanceof Date ? value.toISOString() : value;
  if (!text || text.length < 10) return null;
  const match = DAY_PATTERN.exec(text);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The inverse of `dayFromString`, in the shape the API stores calendar days. */
export function dayToString(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T00:00:00.000Z`;
}

/** Finished, counted trips, oldest first. */
export function finishedTrips({
  trips,
  now,
}: {
  trips: readonly StatsTrip[];
  now: Date;
}): FinishedTrip[] {
  const today = startOfDay(now);
  const finished: FinishedTrip[] = [];
  for (const trip of trips) {
    if (trip.deleted || trip.excludedFromStats) continue;
    const start = dayFromString(trip.startDate);
    if (!start) continue;
    const endDay = dayFromString(trip.endDate) ?? start;
    const end = endDay < start ? start : endDay;
    if (end >= today) continue;
    finished.push({ trip, start, end, nights: Math.max(differenceInCalendarDays(end, start), 0) });
  }
  return finished.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function scopeIncludes({ scope, trip }: { scope: Scope; trip: FinishedTrip }): boolean {
  if (scope.year != null && trip.start.getFullYear() !== scope.year) return false;
  if (scope.activity != null && !trip.trip.log?.activities.includes(scope.activity)) return false;
  return true;
}

export function computeTotals(trips: readonly FinishedTrip[]): Totals {
  const days = new Set<number>();
  for (const trip of trips) {
    for (let day = trip.start; day <= trip.end; day = addDays(day, 1)) {
      days.add(day.getTime());
    }
  }
  const distances = trips.flatMap((trip) => numberOrEmpty(trip.trip.log?.distanceMeters));
  const gains = trips.flatMap((trip) => numberOrEmpty(trip.trip.log?.elevationGainMeters));
  return {
    trips: trips.length,
    nights: trips.reduce((sum, trip) => sum + trip.nights, 0),
    days: days.size,
    places: distinctPlaces(
      trips.flatMap((trip) => (trip.trip.location ? [trip.trip.location] : [])),
    ),
    distance: distances.length ? sum(distances) : null,
    elevationGain: gains.length ? sum(gains) : null,
  };
}

function numberOrEmpty(value: number | null | undefined): number[] {
  return value == null ? [] : [value];
}

/**
 * The same spot reached twice counts once: a location within a kilometre of one already counted
 * is the same place. A distance check rather than rounded coordinates, which split two points
 * either side of a grid line.
 */
function distinctPlaces(locations: readonly Coordinate[]): number {
  const places: Coordinate[] = [];
  for (const location of locations) {
    if (!places.some((place) => distanceMeters({ from: place, to: location }) < 1_000))
      places.push(location);
  }
  return places.length;
}

/**
 * Trips starting inside the window, with their end clipped to it, so a comparison window never
 * counts nights past its last day.
 */
export function clipTrips({
  trips,
  window,
}: {
  trips: readonly FinishedTrip[];
  window: DayWindow;
}): FinishedTrip[] {
  return trips.flatMap((trip) => {
    if (trip.start < window.start || trip.start > window.end) return [];
    const end = trip.end < window.end ? trip.end : window.end;
    return [{ ...trip, end, nights: Math.max(differenceInCalendarDays(end, trip.start), 0) }];
  });
}

/** Meteorological seasons, flipped south of the equator so a December Patagonia trip is summer. */
export function seasonOf({ month, latitude }: { month: number; latitude?: number | null }): Season {
  const northern: Season =
    month >= 3 && month <= 5
      ? 'spring'
      : month >= 6 && month <= 8
        ? 'summer'
        : month >= 9 && month <= 11
          ? 'autumn'
          : 'winter';
  if (latitude == null || latitude >= 0) return northern;
  const flipped = {
    spring: 'autumn',
    summer: 'winter',
    autumn: 'spring',
    winter: 'summer',
  } as const;
  return flipped[northern];
}

/** Catalog items are one thing however they're named; hand-typed items match by name. */
export function gearKey(item: StatsPackItem): string {
  if (item.catalogItemId != null) return `catalog:${item.catalogItemId}`;
  return `name:${item.name.trim().toLowerCase()}`;
}

const MINIMUM_MONTHS_AWAY = 3;
const MAXIMUM_MONTHS_SHOWN = 6;
/** Pace is judged only once a month has passed; one trip in its first week isn't a pace. */
const DAYS_BEFORE_PACE_COUNTS = 30;

export function isBackToPace(comeback: Comeback): boolean {
  return (
    comeback.daysBack >= DAYS_BEFORE_PACE_COUNTS &&
    comeback.now.trips >= comeback.before.trips &&
    comeback.now.nights >= comeback.before.nights
  );
}

/**
 * The latest break of three months or more and the trip that ended it, if that trip is recent
 * enough to still show and the user isn't yet back to the pace of the year before the break.
 */
export function findComeback({
  finished,
  today,
}: {
  finished: readonly FinishedTrip[];
  today: Date;
}): Comeback | null {
  const first = finished[0];
  if (!first || finished.length < 2) return null;
  // Trips can overlap, so a break starts at the latest end so far, not the previous trip's end.
  let latestEnd = first.end;
  let found: { trip: FinishedTrip; breakStart: Date; months: number } | null = null;
  for (const trip of finished.slice(1)) {
    const months = differenceInMonths(trip.start, latestEnd);
    if (months >= MINIMUM_MONTHS_AWAY) found = { trip, breakStart: latestEnd, months };
    if (trip.end > latestEnd) latestEnd = trip.end;
  }
  if (!found) return null;
  if (today >= addMonths(found.trip.start, MAXIMUM_MONTHS_SHOWN)) return null;

  const since = clipTrips({ trips: finished, window: { start: found.trip.start, end: today } });
  const prior = clipTrips({
    trips: finished,
    window: {
      start: addYears(found.breakStart, -1),
      end: found.breakStart,
    },
  });
  const daysBack = differenceInCalendarDays(today, found.trip.start);
  // At least a month as the divisor, so the first days back don't inflate to a monthly rate.
  const monthsBack = Math.max(daysBack / 30.44, 1);
  const comeback: Comeback = {
    trip: found.trip,
    monthsAway: found.months,
    now: pace({ trips: since, months: monthsBack }),
    before: pace({ trips: prior, months: 12 }),
    daysBack,
  };
  return isBackToPace(comeback) ? null : comeback;
}

function pace({ trips, months }: { trips: readonly FinishedTrip[]; months: number }): Pace {
  const totals = computeTotals(trips);
  return {
    trips: totals.trips / months,
    nights: totals.nights / months,
    distance: totals.distance == null ? null : totals.distance / months,
  };
}

interface Tally {
  nights: number;
  trips: number;
}

/** Positive when `a` is busier: more nights, then more trips. */
function compareTally({ a, b }: { a: Tally; b: Tally }): number {
  return a.nights - b.nights || a.trips - b.trips;
}

export function computeTripStats({
  trips,
  packs,
  scope = ALL_SCOPE,
  now = new Date(),
}: {
  trips: readonly StatsTrip[];
  packs: readonly StatsPack[];
  scope?: Scope;
  now?: Date;
}): TripStatsRecord {
  const today = startOfDay(now);
  const allFinished = finishedTrips({ trips, now });
  const logged = new Set(allFinished.flatMap((trip) => trip.trip.log?.activities ?? []));
  const finished = allFinished.filter((trip) => scopeIncludes({ scope, trip }));

  const thisYearStart = new Date(today.getFullYear(), 0, 1);
  const hadEarlierTrips = finished.some((trip) => trip.start < thisYearStart);

  const distanceOf = (trip: FinishedTrip) => trip.trip.log?.distanceMeters ?? 0;
  const withDistance = finished.filter((trip) => distanceOf(trip) > 0);

  const byActivity = new Map<TripActivity, ActivityBucket>();
  for (const trip of finished) {
    for (const activity of new Set(trip.trip.log?.activities ?? [])) {
      const bucket = byActivity.get(activity) ?? { activity, trips: 0, nights: 0, distance: 0 };
      bucket.trips += 1;
      bucket.nights += trip.nights;
      bucket.distance += distanceOf(trip);
      byActivity.set(activity, bucket);
    }
  }

  const routes = finished.flatMap((trip) => {
    const encoded = trip.trip.log?.route;
    if (!encoded) return [];
    const coordinates = decodePolyline(encoded);
    return coordinates.length >= 2 ? [{ id: trip.trip.id, name: trip.trip.name, coordinates }] : [];
  });

  const firstMonth =
    scope.year != null ? new Date(scope.year, 0, 1) : addMonths(startOfMonth(today), -11);
  const months: MonthBucket[] = Array.from({ length: 12 }, (_, offset) => ({
    month: addMonths(firstMonth, offset),
    trips: 0,
    nights: 0,
  }));
  const byMonth = new Map<number, Tally>();
  const bySeason = new Map<Season, Tally>();
  for (const trip of finished) {
    const bucket = months.find((m) => m.month.getTime() === startOfMonth(trip.start).getTime());
    if (bucket) {
      bucket.trips += 1;
      bucket.nights += trip.nights;
    }
    const month = trip.start.getMonth() + 1;
    const monthTotal = byMonth.get(month) ?? { nights: 0, trips: 0 };
    byMonth.set(month, { nights: monthTotal.nights + trip.nights, trips: monthTotal.trips + 1 });
    const season = seasonOf({ month, latitude: trip.trip.location?.latitude });
    const seasonTotal = bySeason.get(season) ?? { nights: 0, trips: 0 };
    bySeason.set(season, {
      nights: seasonTotal.nights + trip.nights,
      trips: seasonTotal.trips + 1,
    });
  }
  // By nights, then trips; remaining ties go to the earlier month, as on Swift.
  const busiestMonth = first(
    [...byMonth.entries()].sort((a, b) => compareTally({ a: b[1], b: a[1] }) || a[0] - b[0]),
  );
  const busiestSeason = first(
    [...bySeason.entries()].sort(
      (a, b) => compareTally({ a: b[1], b: a[1] }) || b[0].localeCompare(a[0]),
    ),
  );

  const packsById = new Map(packs.filter((pack) => !pack.deleted).map((pack) => [pack.id, pack]));
  const gear = new Map<string, { name: string; trips: number }>();
  const packWeights: WeightPoint[] = [];
  for (const trip of finished) {
    const pack = trip.trip.packId ? packsById.get(trip.trip.packId) : undefined;
    if (!pack) continue;
    // An item counts once per trip however many times it is in the pack.
    const seen = new Set<string>();
    for (const item of pack.items) {
      if (item.deleted) continue;
      const key = gearKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      const count = gear.get(key) ?? { name: item.name, trips: 0 };
      gear.set(key, { name: count.name, trips: count.trips + 1 });
    }
    if (pack.baseWeight && pack.baseWeight > 0) {
      packWeights.push({
        id: trip.trip.id,
        date: trip.start,
        grams: pack.baseWeight,
        packName: pack.name,
      });
    }
  }

  return {
    scope,
    availableYears: [...new Set(allFinished.map((trip) => trip.start.getFullYear()))].sort(
      (a, b) => b - a,
    ),
    availableActivities: TRIP_ACTIVITIES.filter((activity) => logged.has(activity)),
    hasTrips: allFinished.length > 0,
    finished,
    allFinished,
    totals: computeTotals(finished),
    thisYear: computeTotals(
      clipTrips({ trips: finished, window: { start: thisYearStart, end: today } }),
    ),
    lastYearToDate: hadEarlierTrips
      ? computeTotals(
          clipTrips({
            trips: finished,
            window: { start: addYears(thisYearStart, -1), end: addYears(today, -1) },
          }),
        )
      : null,
    // Longest first. `finished` is oldest first and the sort is stable, so ties go to the
    // earlier trip, as on Swift.
    longestByNights:
      first(
        sort(
          finished.filter((trip) => trip.nights > 0),
          (trip) => trip.nights,
          true,
        ),
      ) ?? null,
    longestByDistance: first(sort(withDistance, distanceOf, true)) ?? null,
    averageNights: finished.length
      ? finished.reduce((total, trip) => total + trip.nights, 0) / finished.length
      : null,
    averageDistance: withDistance.length
      ? sum(withDistance.map(distanceOf)) / withDistance.length
      : null,
    activities: [...byActivity.values()].sort(
      (a, b) => b.trips - a.trips || a.activity.localeCompare(b.activity),
    ),
    routes,
    months,
    busiestMonth: busiestMonth?.[0] ?? null,
    busiestSeason: busiestSeason?.[0] ?? null,
    topGear: [...gear.entries()]
      .map(([id, value]) => ({ id, name: value.name, trips: value.trips }))
      .sort((a, b) => b.trips - a.trips || a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
      .slice(0, 10),
    packWeights,
    comeback: findComeback({ finished, today }),
  };
}
