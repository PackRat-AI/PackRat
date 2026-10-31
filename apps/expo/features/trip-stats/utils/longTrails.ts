import { type Coordinate, decodePolyline } from './polyline';
import type { FinishedTrip } from './tripStats';

const METERS_PER_MILE = 1_609.344;
const METERS_PER_DEGREE_LATITUDE = 110_574;
const METERS_PER_DEGREE_LONGITUDE_AT_EQUATOR = 111_320;

/** A station every 400 m along the line; a station stands for the stretch since the last one. */
export const STATION_SPACING_METERS = 400;

/**
 * How close a route has to pass to a station to walk it: the trail line is simplified to ~150 m,
 * and GPS and route simplification add a little.
 */
export const MATCH_METERS = 300;

export interface TrailStation {
  line: number;
  coordinate: Coordinate;
  /** The length of trail this station stands for: the stretch since the previous one. */
  meters: number;
}

/**
 * A long-distance trail a user can follow, from the bundled `longTrails.json` (built by
 * `apps/swift/scripts/generate-long-trails.ts` from each trail's official centerline).
 */
export interface LongTrail {
  /** e.g. "PCT". Stable, and what a long-trail goal stores. */
  code: string;
  name: string;
  /** The length the trail's stewards publish, which is what the user sees. */
  officialMiles: number;
  officialMeters: number;
  states: readonly string[];
  lines: readonly (readonly Coordinate[])[];
  stations: readonly TrailStation[];
  /**
   * The bundled line's own length, shorter than the official one for the simplification.
   * Progress is a share of this, shown as a share of the official length.
   */
  lineMeters: number;
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
}

/** A row of the bundled file: lines are encoded polylines, precision 5, like trip routes. */
export interface LongTrailRow {
  code: string;
  name: string;
  officialMiles: number;
  states: string[];
  lines: string[];
}

/** Metres on a flat plane around a point: plenty at the few hundred metres matching works at. */
export function localDistance({ a, b }: { a: Coordinate; b: Coordinate }): number {
  const scale =
    Math.cos((((a.latitude + b.latitude) / 2) * Math.PI) / 180) *
    METERS_PER_DEGREE_LONGITUDE_AT_EQUATOR;
  const dx = (b.longitude - a.longitude) * scale;
  const dy = (b.latitude - a.latitude) * METERS_PER_DEGREE_LATITUDE;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Shortest distance from `point` to the segment `a`–`b`. */
function distanceToSegment({
  point,
  a,
  b,
}: {
  point: Coordinate;
  a: Coordinate;
  b: Coordinate;
}): number {
  const scale = Math.cos((point.latitude * Math.PI) / 180) * METERS_PER_DEGREE_LONGITUDE_AT_EQUATOR;
  const bx = (b.longitude - a.longitude) * scale;
  const by = (b.latitude - a.latitude) * METERS_PER_DEGREE_LATITUDE;
  const px = (point.longitude - a.longitude) * scale;
  const py = (point.latitude - a.latitude) * METERS_PER_DEGREE_LATITUDE;
  const lengthSquared = bx * bx + by * by;
  const t = lengthSquared > 0 ? Math.min(Math.max((px * bx + py * by) / lengthSquared, 0), 1) : 0;
  const dx = px - t * bx;
  const dy = py - t * by;
  return Math.sqrt(dx * dx + dy * dy);
}

/** A station every `STATION_SPACING_METERS`, plus one at the end for the remainder. */
function stationsAlong({ line, index }: { line: readonly Coordinate[]; index: number }) {
  const stations: TrailStation[] = [];
  if (line.length < 2) return stations;
  let sinceLast = 0;
  for (let i = 1; i < line.length; i += 1) {
    const a = line[i - 1];
    const b = line[i];
    if (!a || !b) continue;
    const length = localDistance({ a, b });
    if (length <= 0) continue;
    let along = 0;
    while (sinceLast + (length - along) >= STATION_SPACING_METERS) {
      along += STATION_SPACING_METERS - sinceLast;
      const t = along / length;
      stations.push({
        line: index,
        coordinate: {
          latitude: a.latitude + (b.latitude - a.latitude) * t,
          longitude: a.longitude + (b.longitude - a.longitude) * t,
        },
        meters: STATION_SPACING_METERS,
      });
      sinceLast = 0;
    }
    sinceLast += length - along;
  }
  const last = line[line.length - 1];
  if (sinceLast > 1 && last) stations.push({ line: index, coordinate: last, meters: sinceLast });
  return stations;
}

export function makeLongTrail({
  code,
  name,
  officialMiles,
  states,
  lines,
}: Omit<LongTrailRow, 'lines'> & { lines: readonly (readonly Coordinate[])[] }): LongTrail {
  const stations = lines.flatMap((line, index) => stationsAlong({ line, index }));
  const points = lines.flat();
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  return {
    code,
    name,
    officialMiles,
    officialMeters: officialMiles * METERS_PER_MILE,
    states,
    lines,
    stations,
    lineMeters: stations.reduce((sum, station) => sum + station.meters, 0),
    minLatitude: points.length ? Math.min(...latitudes) : 0,
    maxLatitude: points.length ? Math.max(...latitudes) : 0,
    minLongitude: points.length ? Math.min(...longitudes) : 0,
    maxLongitude: points.length ? Math.max(...longitudes) : 0,
  };
}

export function longTrailFromRow(row: LongTrailRow): LongTrail {
  return makeLongTrail({
    ...row,
    lines: row.lines.map(decodePolyline).filter((line) => line.length >= 2),
  });
}

const GRID_CELL_DEGREES = 0.005;
const MAX_CELLS_PER_SEGMENT = 40_000;

function cellOf(point: Coordinate): [number, number] {
  return [
    Math.floor(point.longitude / GRID_CELL_DEGREES),
    Math.floor(point.latitude / GRID_CELL_DEGREES),
  ];
}

/** Route segments bucketed by ~550 m cells, so a station checks only the segments near it. */
function segmentGrid(route: readonly Coordinate[]): Map<string, number[]> {
  const buckets = new Map<string, number[]>();
  for (let i = 1; i < route.length; i += 1) {
    const a = route[i - 1];
    const b = route[i];
    if (!a || !b) continue;
    const [x0, y0] = cellOf({
      latitude: Math.min(a.latitude, b.latitude),
      longitude: Math.min(a.longitude, b.longitude),
    });
    const [x1, y1] = cellOf({
      latitude: Math.max(a.latitude, b.latitude),
      longitude: Math.max(a.longitude, b.longitude),
    });
    // A long straight segment (a sparse import) spans many cells; cap the sweep.
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > MAX_CELLS_PER_SEGMENT) continue;
    for (let x = x0; x <= x1; x += 1) {
      for (let y = y0; y <= y1; y += 1) {
        const key = `${x},${y}`;
        const bucket = buckets.get(key);
        if (bucket) bucket.push(i);
        else buckets.set(key, [i]);
      }
    }
  }
  return buckets;
}

// One cell is at least ~330 m east–west up to 53° north, which covers `MATCH_METERS`.
const GRID_REACH = Math.ceil(MATCH_METERS / (GRID_CELL_DEGREES * METERS_PER_DEGREE_LATITUDE * 0.6));

function isNearRoute({
  point,
  route,
  grid,
}: {
  point: Coordinate;
  route: readonly Coordinate[];
  grid: Map<string, number[]>;
}): boolean {
  const [cx, cy] = cellOf(point);
  for (let x = cx - GRID_REACH; x <= cx + GRID_REACH; x += 1) {
    for (let y = cy - GRID_REACH; y <= cy + GRID_REACH; y += 1) {
      for (const i of grid.get(`${x},${y}`) ?? []) {
        const a = route[i - 1];
        const b = route[i];
        if (a && b && distanceToSegment({ point, a, b }) <= MATCH_METERS) return true;
      }
    }
  }
  return false;
}

/** The stations `route` walks: those within `MATCH_METERS` of one of its segments. */
export function stationsWalked({
  trail,
  route,
}: {
  trail: LongTrail;
  route: readonly Coordinate[];
}): Set<number> {
  const walked = new Set<number>();
  if (route.length < 2) return walked;
  const pad = MATCH_METERS / METERS_PER_DEGREE_LATITUDE;
  const latitudes = route.map((point) => point.latitude);
  const longitudes = route.map((point) => point.longitude);
  const south = Math.min(...latitudes) - pad;
  const north = Math.max(...latitudes) + pad;
  // Longitude degrees shrink toward the poles; 0.6 covers up to ~53°.
  const west = Math.min(...longitudes) - pad / 0.6;
  const east = Math.max(...longitudes) + pad / 0.6;
  if (
    north < trail.minLatitude ||
    south > trail.maxLatitude ||
    east < trail.minLongitude ||
    west > trail.maxLongitude
  ) {
    return walked;
  }
  const grid = segmentGrid(route);
  trail.stations.forEach((station, index) => {
    const { latitude, longitude } = station.coordinate;
    if (latitude < south || latitude > north || longitude < west || longitude > east) return;
    if (isNearRoute({ point: station.coordinate, route, grid })) walked.add(index);
  });
  return walked;
}

/**
 * Matching a route against a trail is the slow part, and a trip's route rarely changes, so each
 * answer is kept per trail and trip, along with the route it was worked out from.
 */
export type LongTrailCache = Map<string, { route: string; walked: Set<number> }>;

function cachedStationsWalked({
  trail,
  trip,
  cache,
}: {
  trail: LongTrail;
  trip: FinishedTrip;
  cache?: LongTrailCache;
}): Set<number> {
  const encoded = trip.trip.log?.route;
  if (!encoded) return new Set();
  const key = `${trail.code}|${trip.trip.id}`;
  const known = cache?.get(key);
  if (known && known.route === encoded) return known.walked;
  const walked = stationsWalked({ trail, route: decodePolyline(encoded) });
  cache?.set(key, { route: encoded, walked });
  return walked;
}

/** A trip whose route walked part of the trail. */
export interface TrailTripSection {
  trip: FinishedTrip;
  /** Official-scale metres of the trail this trip walked. */
  meters: number;
  /** Of those, the metres no earlier trip had walked. */
  newMeters: number;
}

/** How much of a long trail the user's finished trips have walked, from their logged routes. */
export interface LongTrailProgress {
  trail: LongTrail;
  /** Indices into `trail.stations`. */
  walked: ReadonlySet<number>;
  /** 0…1 of the trail. */
  fraction: number;
  /** On the official length's scale, so "of 2,650 mi" adds up. */
  meters: number;
  /** Oldest first. */
  trips: readonly TrailTripSection[];
}

function stationMeters({ trail, walked }: { trail: LongTrail; walked: Iterable<number> }) {
  let sum = 0;
  for (const index of walked) sum += trail.stations[index]?.meters ?? 0;
  return sum;
}

export function computeLongTrailProgress({
  trail,
  finished,
  cache,
}: {
  trail: LongTrail;
  finished: readonly FinishedTrip[];
  cache?: LongTrailCache;
}): LongTrailProgress {
  const walked = new Set<number>();
  const trips: TrailTripSection[] = [];
  const scale = trail.lineMeters > 0 ? trail.officialMeters / trail.lineMeters : 1;
  const oldestFirst = [...finished].sort((a, b) => a.start.getTime() - b.start.getTime());
  for (const trip of oldestFirst) {
    const stations = cachedStationsWalked({ trail, trip, cache });
    if (stations.size === 0) continue;
    const fresh = [...stations].filter((index) => !walked.has(index));
    trips.push({
      trip,
      meters: stationMeters({ trail, walked: stations }) * scale,
      newMeters: stationMeters({ trail, walked: fresh }) * scale,
    });
    for (const index of stations) walked.add(index);
  }
  const fraction =
    trail.lineMeters > 0 ? Math.min(stationMeters({ trail, walked }) / trail.lineMeters, 1) : 0;
  return { trail, walked, fraction, meters: fraction * trail.officialMeters, trips };
}

/**
 * The walked stretches as lines to draw over the trail. Each station stands for the stretch since
 * the one before, so a run starts at the station before its first walked one.
 */
export function walkedLines(progress: LongTrailProgress): Coordinate[][] {
  const { trail, walked } = progress;
  const lines: Coordinate[][] = [];
  let current: Coordinate[] = [];
  const close = () => {
    if (current.length >= 2) lines.push(current);
    current = [];
  };
  trail.stations.forEach((station, index) => {
    if (!walked.has(index)) {
      close();
      return;
    }
    const previous = index > 0 ? trail.stations[index - 1] : undefined;
    const lineStart = trail.lines[station.line]?.[0];
    if (current.length === 0) {
      if (previous && previous.line === station.line) current.push(previous.coordinate);
      else if (lineStart) current.push(lineStart);
    } else if (previous && previous.line !== station.line) {
      close();
      if (lineStart) current.push(lineStart);
    }
    current.push(station.coordinate);
  });
  close();
  return lines;
}
