import type { TripLandscape, TripLog } from '@packrat/schemas/trips';
import { type Coordinate, decodePolyline } from './polyline';
import type { FinishedTrip, StatsTrip } from './tripStats';

/**
 * Pure: which landscape each trip was in, and the breakdown for the stats screen. The same reading
 * as the Swift app's `TripLandscapes`, from the same grid.
 */

/** The order landscapes are offered in and break ties in. */
export const TRIP_LANDSCAPES = Object.freeze([
  'desert',
  'mountain',
  'forest',
  'coastal',
  'water',
  'grassland',
  'polar',
] as const satisfies readonly TripLandscape[]);

/** The byte for each landscape in the grid; 0 is open sea. */
const GRID_CODES = Object.freeze({
  1: 'desert',
  2: 'grassland',
  3: 'forest',
  4: 'polar',
  5: 'mountain',
  6: 'coastal',
  7: 'water',
} as const satisfies Record<number, TripLandscape>);

function landscapeForCode(code: number): TripLandscape | null {
  return code in GRID_CODES ? GRID_CODES[code as keyof typeof GRID_CODES] : null;
}

const CELL_SIZE = 0.05;
const GRID_WIDTH = 7_200;
const GRID_HEIGHT = 3_600;

/**
 * One code per 0.05° cell, row 0 at 90°N, column 0 at 180°W, held as runs per row. Per row: a
 * UInt16 run count, that many UInt16 last columns, then that many UInt8 codes, little-endian.
 */
export interface LandscapeGrid {
  bytes: Uint8Array;
  /** Where each row starts in `bytes`; empty when the data is unreadable. */
  rowOffsets: Uint32Array;
}

export const EMPTY_LANDSCAPE_GRID: LandscapeGrid = Object.freeze({
  bytes: new Uint8Array(0),
  rowOffsets: new Uint32Array(0),
});

/** Indexes the rows. A truncated file reads as empty. */
export function decodeLandscapeGrid(bytes: Uint8Array): LandscapeGrid {
  const rowOffsets = new Uint32Array(GRID_HEIGHT);
  let offset = 0;
  for (let row = 0; row < GRID_HEIGHT; row++) {
    if (offset + 2 > bytes.length) return EMPTY_LANDSCAPE_GRID;
    const count = readUint16({ bytes, at: offset });
    if (count === 0 || offset + 2 + count * 3 > bytes.length) return EMPTY_LANDSCAPE_GRID;
    rowOffsets[row] = offset;
    offset += 2 + count * 3;
  }
  return { bytes, rowOffsets };
}

function readUint16({ bytes, at }: { bytes: Uint8Array; at: number }): number {
  return (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8);
}

export function gridCode({
  grid,
  row,
  column,
}: {
  grid: LandscapeGrid;
  row: number;
  column: number;
}): number {
  if (row < 0 || row >= grid.rowOffsets.length) return 0;
  const start = grid.rowOffsets[row] ?? 0;
  const count = readUint16({ bytes: grid.bytes, at: start });
  const wrapped = ((column % GRID_WIDTH) + GRID_WIDTH) % GRID_WIDTH;
  // The first run whose last column reaches this one.
  let low = 0;
  let high = count - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (readUint16({ bytes: grid.bytes, at: start + 2 + mid * 2 }) < wrapped) low = mid + 1;
    else high = mid;
  }
  return grid.bytes[start + 2 + count * 2 + low] ?? 0;
}

/**
 * The landscape at a spot. A point just offshore (a beach pin, a simplified coastline) reads as
 * coastal when land is within two cells.
 */
export function landscapeAt({
  grid,
  point,
}: {
  grid: LandscapeGrid;
  point: Coordinate;
}): TripLandscape | null {
  if (grid.rowOffsets.length === 0) return null;
  const row = Math.floor((90 - point.latitude) / CELL_SIZE);
  const column = Math.floor((point.longitude + 180) / CELL_SIZE);
  const here = landscapeForCode(gridCode({ grid, row, column }));
  if (here) return here;
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      if (landscapeForCode(gridCode({ grid, row: row + dr, column: column + dc }))) {
        return 'coastal';
      }
    }
  }
  return null;
}

/** The trip's pinned spot, else the middle of its route. */
export function landscapeSpot(trip: Pick<StatsTrip, 'location' | 'log'>): Coordinate | null {
  if (trip.location) {
    return { latitude: trip.location.latitude, longitude: trip.location.longitude };
  }
  const route = trip.log?.route ? decodePolyline(trip.log.route) : [];
  return route[Math.floor(route.length / 2)] ?? null;
}

/**
 * 500 m of climbing at 40 m a kilometre or more is a mountain day by most hiking-difficulty scales
 * (Shenandoah's rating, AllTrails' "hard"). A summit or a climbing or ski trip is one outright.
 */
export function isMountainous(
  log: Pick<TripLog, 'activities' | 'summits' | 'elevationGainMeters' | 'distanceMeters'>,
): boolean {
  if ((log.summits ?? []).length > 0) return true;
  if (log.activities.some((a) => a === 'climbing' || a === 'mountaineering' || a === 'skiing')) {
    return true;
  }
  const gain = log.elevationGainMeters;
  if (gain == null || gain < 500) return false;
  const distance = log.distanceMeters;
  if (distance == null || distance <= 0) return true;
  return gain / (distance / 1_000) >= 40;
}

/**
 * The user's choice, else the map's answer at the trip's spot, sharpened by the log: a summit, a
 * climbing or ski trip, or steady climbing turns open country into mountain, and a paddling trip
 * inland is lakes and rivers.
 */
export function tripLandscape({
  trip,
  grid,
}: {
  trip: Pick<StatsTrip, 'location' | 'log'>;
  grid: LandscapeGrid;
}): TripLandscape | null {
  const chosen = trip.log?.landscape;
  if (chosen) return chosen;
  const spot = landscapeSpot(trip);
  const mapped = spot ? landscapeAt({ grid, point: spot }) : null;
  const log = trip.log;
  if (!mapped || !log) return mapped;
  if (mapped !== 'forest' && mapped !== 'grassland' && mapped !== 'desert') return mapped;
  if (isMountainous(log)) return 'mountain';
  if (log.activities.includes('paddling')) return 'water';
  return mapped;
}

export interface LandscapeBucket {
  landscape: TripLandscape;
  /** Newest first. */
  trips: FinishedTrip[];
}

/** Trips by landscape, most trips first; trips with no place are left out. */
export function computeTripLandscapes({
  finished,
  grid,
}: {
  finished: readonly FinishedTrip[];
  grid: LandscapeGrid;
}): LandscapeBucket[] {
  const grouped = new Map<TripLandscape, FinishedTrip[]>();
  for (const trip of finished) {
    const landscape = tripLandscape({ trip: trip.trip, grid });
    if (!landscape) continue;
    grouped.set(landscape, [...(grouped.get(landscape) ?? []), trip]);
  }
  return [...grouped]
    .map(([landscape, trips]) => ({
      landscape,
      trips: [...trips].sort((a, b) => b.start.getTime() - a.start.getTime()),
    }))
    .sort(
      (a, b) =>
        b.trips.length - a.trips.length ||
        TRIP_LANDSCAPES.indexOf(a.landscape) - TRIP_LANDSCAPES.indexOf(b.landscape),
    );
}
