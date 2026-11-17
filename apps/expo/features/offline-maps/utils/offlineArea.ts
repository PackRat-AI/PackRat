import type { LonLat, OfflineArea, OfflineAreaBounds, OfflineDetailLevel } from '../types';

/**
 * Deepest zoom each detail level keeps. Both end on a Mapbox tile-pack group edge (0-5, 6-10,
 * 11-14, 15-16): a request inside a group downloads the whole group anyway, so stopping mid-group
 * would cost the same space and show less.
 */
export const DETAIL_MAX_ZOOM = Object.freeze({ standard: 14, trail: 16 } as const);

export const DETAIL_LEVELS = Object.freeze(['standard', 'trail'] as const);

/** Storage limit choices, in bytes. Zero means no limit. */
export const STORAGE_LIMIT_CHOICES = Object.freeze([
  0, 500_000_000, 1_000_000_000, 2_000_000_000, 5_000_000_000,
] as const);

/**
 * Mapbox refuses a download that would take the device past 750 unique tile packs across every
 * saved area. Our count runs a few packs under the SDK's, so keep a margin rather than offer a
 * download the SDK will turn down. Same figures as `OfflineTilePacks` in the Swift app.
 */
export const TILE_PACK_LIMIT = 750;
export const TILE_PACK_BUDGET = 700;

/**
 * Average bytes one Outdoors vector tile takes on disk, used to size an area before it downloads.
 * The Android SDK binding offers no size estimate, so the picker counts tiles instead.
 */
export const BYTES_PER_TILE = 40_000;

/** Closed ring around the bounds, counter-clockwise from the south-west corner. */
export function boundsRing(bounds: OfflineAreaBounds): LonLat[] {
  const { south, west, north, east } = bounds;
  return [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ];
}

/** The rectangle around every point of a set of lines, or null when there are none. */
export function boundsEnclosing(lines: LonLat[][]): OfflineAreaBounds | null {
  const points = lines.flat();
  const first = points[0];
  if (!first) return null;
  const bounds = { south: first[1], west: first[0], north: first[1], east: first[0] };
  for (const [lon, lat] of points) {
    bounds.south = Math.min(bounds.south, lat);
    bounds.north = Math.max(bounds.north, lat);
    bounds.west = Math.min(bounds.west, lon);
    bounds.east = Math.max(bounds.east, lon);
  }
  return bounds;
}

/** Bounds from the map's `[longitude, latitude]` corners, or null if either is incomplete. */
export function boundsFromCorners({
  ne,
  sw,
}: {
  ne: number[];
  sw: number[];
}): OfflineAreaBounds | null {
  const [east, north] = ne;
  const [west, south] = sw;
  if (east === undefined || north === undefined || west === undefined || south === undefined) {
    return null;
  }
  return { south, west, north, east };
}

/** Grows the bounds by `fraction` of their span on every side, with a floor for a single point. */
export function padBounds(bounds: OfflineAreaBounds, fraction = 0.2): OfflineAreaBounds {
  const latPad = Math.max((bounds.north - bounds.south) * fraction, 0.02);
  const lonPad = Math.max((bounds.east - bounds.west) * fraction, 0.02);
  return {
    south: Math.max(bounds.south - latPad, -85),
    west: Math.max(bounds.west - lonPad, -180),
    north: Math.min(bounds.north + latPad, 85),
    east: Math.min(bounds.east + lonPad, 180),
  };
}

type TileRange = { minX: number; maxX: number; minY: number; maxY: number };

/** The tile columns and rows the bounds touch at `zoom`, in Web Mercator tile space. */
export function tileRange(bounds: OfflineAreaBounds, zoom: number): TileRange {
  const scale = 2 ** zoom;
  const last = scale - 1;
  const clamp = (value: number) => Math.min(Math.max(Math.floor(value), 0), last);
  const x = (lon: number) => ((lon + 180) / 360) * scale;
  const y = (lat: number) => {
    const rad = (Math.min(Math.max(lat, -85.0511), 85.0511) * Math.PI) / 180;
    return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * scale;
  };
  return {
    minX: clamp(x(bounds.west)),
    maxX: clamp(x(bounds.east)),
    minY: clamp(y(bounds.north)),
    maxY: clamp(y(bounds.south)),
  };
}

function tileCount(bounds: OfflineAreaBounds, zoom: number): number {
  const range = tileRange(bounds, zoom);
  return (range.maxX - range.minX + 1) * (range.maxY - range.minY + 1);
}

/** Bytes the area would take on disk at the given detail. */
export function estimateBytes(bounds: OfflineAreaBounds, detail: OfflineDetailLevel): number {
  let tiles = 0;
  for (let zoom = 0; zoom <= DETAIL_MAX_ZOOM[detail]; zoom++) tiles += tileCount(bounds, zoom);
  return tiles * BYTES_PER_TILE;
}

/** Each pack group's index zoom: one pack per tile at that zoom. */
const INDEX_ZOOMS = Object.freeze({
  standard: [
    [0, 0],
    [6, 6],
    [11, 11],
  ],
  trail: [
    [0, 0],
    [6, 6],
    [11, 11],
    [15, 12],
  ],
} as const);

/**
 * The tile packs covering the bounds at the given detail, as stable keys. Stops early past
 * `maxPacks`: by then the area is far over the limit and the exact count no longer matters.
 */
export function tilePacks({
  bounds,
  detail,
  maxPacks = TILE_PACK_LIMIT * 4,
}: {
  bounds: OfflineAreaBounds;
  detail: OfflineDetailLevel;
  maxPacks?: number;
}): Set<string> {
  const keys = new Set<string>();
  for (const [group, zoom] of INDEX_ZOOMS[detail]) {
    const range = tileRange(bounds, zoom);
    for (let x = range.minX; x <= range.maxX; x++) {
      for (let y = range.minY; y <= range.maxY; y++) {
        keys.add(`${group}/${zoom}/${x}/${y}`);
        if (keys.size > maxPacks) return keys;
      }
    }
  }
  return keys;
}

/**
 * Whether the bounds fit under the tile-pack cap alongside the areas already saved, and whether
 * they would fit on their own.
 */
export function packFit({
  bounds,
  detail,
  saved,
}: {
  bounds: OfflineAreaBounds;
  detail: OfflineDetailLevel;
  saved: Pick<OfflineArea, 'bounds' | 'detail'>[];
}): { fits: boolean; fitsAlone: boolean } {
  const used = new Set<string>();
  for (const area of saved) {
    for (const key of tilePacks(area)) used.add(key);
  }
  const adding = tilePacks({ bounds, detail });
  let added = 0;
  for (const key of adding) if (!used.has(key)) added++;
  return {
    fits: used.size + added <= TILE_PACK_BUDGET,
    fitsAlone: adding.size <= TILE_PACK_BUDGET,
  };
}

/**
 * Saved areas whose removal would make room for `bytes` under the storage limit, oldest first.
 * Empty when no limit is set or the download already fits; null when deleting every area would
 * still not be enough.
 */
export function areasToFree({
  areas,
  bytes,
  limit,
}: {
  areas: OfflineArea[];
  bytes: number;
  limit: number;
}): OfflineArea[] | null {
  const total = totalBytes(areas);
  if (limit <= 0 || total + bytes <= limit) return [];
  let over = total + bytes - limit;
  const picks: OfflineArea[] = [];
  for (const area of [...areas].sort((a, b) => a.savedAt - b.savedAt)) {
    if (over <= 0) break;
    picks.push(area);
    over -= area.sizeBytes;
  }
  return over > 0 ? null : picks;
}

export function totalBytes(areas: Pick<OfflineArea, 'sizeBytes'>[]): number {
  return areas.reduce((sum, area) => sum + area.sizeBytes, 0);
}

export function tripHasEnded(area: Pick<OfflineArea, 'tripEndsAt'>, now: number): boolean {
  return area.tripEndsAt !== undefined && area.tripEndsAt < now;
}

/** Areas for finished trips first, so they are easy to clear out; then newest first. */
export function sortAreas(areas: OfflineArea[], now: number): OfflineArea[] {
  return [...areas].sort((a, b) => {
    const aEnded = tripHasEnded(a, now);
    const bEnded = tripHasEnded(b, now);
    if (aEnded !== bEnded) return aEnded ? -1 : 1;
    return b.savedAt - a.savedAt;
  });
}

/** Byte count as a file size, in decimal units like the system storage screens. */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} bytes`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1000;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}
