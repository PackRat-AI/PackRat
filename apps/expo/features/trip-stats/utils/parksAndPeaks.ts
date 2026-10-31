import type { TripStatsEntry } from '@packrat/schemas/tripStats';
import type { TripSummit } from '@packrat/schemas/trips';
import { type Coordinate, decodePolyline, sampleRoute } from './polyline';
import { type DayWindow, dayFromString, type FinishedTrip, type StatsTrip } from './tripStats';

/** The official count, which the generator checks the dataset against. */
export const NATIONAL_PARK_COUNT = 63;

/** A row of the bundled `nationalParks.json`: rings are flat `[lng, lat, lng, lat, …]`. */
export interface NationalParkRow {
  code: string;
  name: string;
  states: string[];
  rings: number[][];
}

export interface NationalPark {
  /** The NPS unit code, e.g. "YOSE". Stable, and what manual visits store. */
  code: string;
  name: string;
  states: string[];
  /** Outer boundaries and holes alike; the even-odd rule sorts them out. */
  rings: Coordinate[][];
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
}

export function parkFromRow(row: NationalParkRow): NationalPark {
  const rings = row.rings.map((flat) => {
    const ring: Coordinate[] = [];
    for (let index = 0; index + 1 < flat.length; index += 2) {
      ring.push({ longitude: flat[index] ?? 0, latitude: flat[index + 1] ?? 0 });
    }
    return ring;
  });
  const points = rings.flat();
  const lats = points.map((point) => point.latitude);
  const lngs = points.map((point) => point.longitude);
  return {
    code: row.code,
    name: row.name,
    states: row.states,
    rings,
    minLatitude: points.length ? Math.min(...lats) : 0,
    maxLatitude: points.length ? Math.max(...lats) : 0,
    minLongitude: points.length ? Math.min(...lngs) : 0,
    maxLongitude: points.length ? Math.max(...lngs) : 0,
  };
}

export function parkCenter(park: NationalPark): Coordinate {
  return {
    latitude: (park.minLatitude + park.maxLatitude) / 2,
    longitude: (park.minLongitude + park.maxLongitude) / 2,
  };
}

/** Even-odd ray casting over every ring, after a bounding-box check that rules out most parks. */
export function parkContains({ park, point }: { park: NationalPark; point: Coordinate }): boolean {
  if (
    point.latitude < park.minLatitude ||
    point.latitude > park.maxLatitude ||
    point.longitude < park.minLongitude ||
    point.longitude > park.maxLongitude
  ) {
    return false;
  }
  let inside = false;
  for (const ring of park.rings) {
    if (ring.length < 3) continue;
    let j = ring.length - 1;
    for (let i = 0; i < ring.length; i += 1) {
      const a = ring[i];
      const b = ring[j];
      if (a && b && a.latitude > point.latitude !== b.latitude > point.latitude) {
        const crossing =
          ((b.longitude - a.longitude) * (point.latitude - a.latitude)) /
            (b.latitude - a.latitude) +
          a.longitude;
        if (point.longitude < crossing) inside = !inside;
      }
      j = i;
    }
  }
  return inside;
}

/** The same peak however it was reached: by OSM node, else by name. */
export function peakKey(summit: Pick<TripSummit, 'name' | 'osmId'>): string {
  if (summit.osmId != null) return `osm:${summit.osmId}`;
  return `name:${summit.name.trim().toLowerCase()}`;
}

const NON_ALPHANUMERIC = /[^\p{L}\p{N}]+/u;

/** "Mt. Whitney" and "mount whitney" are the same peak. */
export function normalizedPeakName(name: string): string {
  const words = name.toLowerCase().split(NON_ALPHANUMERIC).filter(Boolean);
  if (words[0] === 'mt') words[0] = 'mount';
  return words.join(' ');
}

export type StatsEntry = Pick<
  TripStatsEntry,
  | 'id'
  | 'kind'
  | 'parkCode'
  | 'name'
  | 'elevationMeters'
  | 'latitude'
  | 'longitude'
  | 'osmId'
  | 'date'
  | 'deleted'
>;

/** A hand-added summit entry, as a summit. */
export function entrySummit(entry: StatsEntry): TripSummit | null {
  if (entry.kind !== 'summit' || !entry.name) return null;
  return {
    name: entry.name,
    elevationMeters: entry.elevationMeters ?? null,
    latitude: entry.latitude ?? 0,
    longitude: entry.longitude ?? 0,
    osmId: entry.osmId ?? null,
  };
}

export interface ParkVisit {
  id: string;
  date: Date | null;
  /** Null for a visit added by hand. */
  tripId: string | null;
  tripName: string | null;
}

export interface ParkStatus {
  park: NationalPark;
  /** Oldest first; undated hand-added visits last. */
  visits: ParkVisit[];
}

export interface Ascent {
  id: string;
  summit: TripSummit;
  date: Date | null;
  tripId: string | null;
  tripName: string | null;
}

export interface ParksAndPeaks {
  /** Every park, by name. */
  parks: ParkStatus[];
  /** Every summit logged, newest first; undated ones last. */
  ascents: Ascent[];
}

/** A route can hold 1,500 points; every few is plenty against a boundary simplified to 600 m. */
const ROUTE_SAMPLE_LIMIT = 300;

export function parkCodesVisitedBy({
  trip,
  parks,
}: {
  trip: StatsTrip;
  parks: readonly NationalPark[];
}): Set<string> {
  const points: Coordinate[] = trip.location ? [trip.location] : [];
  if (trip.log?.route) {
    const route = decodePolyline(trip.log.route);
    points.push(...sampleRoute({ route, limit: ROUTE_SAMPLE_LIMIT }));
    const last = route.at(-1);
    if (last) points.push(last);
  }
  const codes = new Set<string>();
  for (const park of parks) {
    if (points.some((point) => parkContains({ park, point }))) codes.add(park.code);
  }
  return codes;
}

export function computeParksAndPeaks({
  finished,
  entries,
  parks,
}: {
  finished: readonly FinishedTrip[];
  entries: readonly StatsEntry[];
  parks: readonly NationalPark[];
}): ParksAndPeaks {
  const active = entries.filter((entry) => !entry.deleted);
  const visitsByPark = new Map<string, ParkVisit[]>();
  const addVisit = ({ code, visit }: { code: string; visit: ParkVisit }) =>
    visitsByPark.set(code, [...(visitsByPark.get(code) ?? []), visit]);
  for (const trip of finished) {
    for (const code of parkCodesVisitedBy({ trip: trip.trip, parks })) {
      addVisit({
        code,
        visit: {
          id: `trip:${trip.trip.id}`,
          date: trip.start,
          tripId: trip.trip.id,
          tripName: trip.trip.name,
        },
      });
    }
  }
  for (const entry of active) {
    if (entry.kind !== 'park' || !entry.parkCode) continue;
    addVisit({
      code: entry.parkCode,
      visit: {
        id: entry.id,
        date: dayFromString(entry.date),
        tripId: null,
        tripName: null,
      },
    });
  }
  const undatedLast = (date: Date | null) => date?.getTime() ?? Number.POSITIVE_INFINITY;
  const parkStatuses = parks.map((park) => ({
    park,
    visits: [...(visitsByPark.get(park.code) ?? [])].sort(
      (a, b) => undatedLast(a.date) - undatedLast(b.date),
    ),
  }));

  const ascents: Ascent[] = [];
  for (const trip of finished) {
    (trip.trip.log?.summits ?? []).forEach((summit, index) => {
      ascents.push({
        id: `trip:${trip.trip.id}:${index}`,
        summit,
        date: trip.start,
        tripId: trip.trip.id,
        tripName: trip.trip.name,
      });
    });
  }
  for (const entry of active) {
    const summit = entrySummit(entry);
    if (summit) {
      ascents.push({
        id: entry.id,
        summit,
        date: dayFromString(entry.date),
        tripId: null,
        tripName: null,
      });
    }
  }
  const undatedFirst = (date: Date | null) => date?.getTime() ?? Number.NEGATIVE_INFINITY;
  ascents.sort((a, b) => undatedFirst(b.date) - undatedFirst(a.date));
  return { parks: parkStatuses, ascents };
}

export function visitedParks(record: ParksAndPeaks): ParkStatus[] {
  return record.parks.filter((status) => status.visits.length > 0);
}

/** Distinct peaks: the same peak climbed twice is one. */
export function peakCount(record: ParksAndPeaks): number {
  return new Set(record.ascents.map((ascent) => peakKey(ascent.summit))).size;
}

export function highestAscent(record: ParksAndPeaks): Ascent | null {
  let best: Ascent | null = null;
  for (const ascent of record.ascents) {
    const elevation = ascent.summit.elevationMeters;
    if (elevation == null) continue;
    if (!best || elevation > (best.summit.elevationMeters ?? 0)) best = ascent;
  }
  return best;
}

/** The newest visit across every park, for the card's "Latest" line. */
export function latestParkVisit(record: ParksAndPeaks): { park: NationalPark; date: Date } | null {
  let latest: { park: NationalPark; date: Date } | null = null;
  for (const status of record.parks) {
    for (const visit of status.visits) {
      if (visit.date && (!latest || visit.date > latest.date)) {
        latest = { park: status.park, date: visit.date };
      }
    }
  }
  return latest;
}

const inWindow = ({ date, window }: { date: Date | null; window: DayWindow }) =>
  date != null && date >= window.start && date <= window.end;

/** Distinct parks with a visit inside the window, both days counted. */
export function parksVisitedBetween({
  record,
  window,
}: {
  record: ParksAndPeaks;
  window: DayWindow;
}): number {
  return record.parks.filter((status) =>
    status.visits.some((visit) => inWindow({ date: visit.date, window })),
  ).length;
}

/** Distinct peaks summited inside the window, both days counted. */
export function peaksSummitedBetween({
  record,
  window,
}: {
  record: ParksAndPeaks;
  window: DayWindow;
}): number {
  return new Set(
    record.ascents
      .filter((ascent) => inWindow({ date: ascent.date, window }))
      .map((ascent) => peakKey(ascent.summit)),
  ).size;
}
