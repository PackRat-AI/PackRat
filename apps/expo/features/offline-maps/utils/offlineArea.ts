import { clamp } from '@packrat/utils';
import type { LonLat, OfflineArea, OfflineAreaBounds, OfflineDetailLevel } from '../types';

/**
 * Deepest zoom each detail level keeps. Both end on a Mapbox tile-pack group edge (0-5, 6-10,
 * 11-14, 15-16): a request inside a group downloads the whole group anyway, so stopping mid-group
 * would cost the same space and show less.
 */
export const DETAIL_MAX_ZOOM = Object.freeze({ standard: 14, trail: 16 } as const);

export const DETAIL_LEVELS = Object.freeze(['standard', 'trail'] as const);

/**
 * Mapbox refuses a download that would take the device past 750 unique tile packs across every
 * saved area. Our count runs a few packs under the SDK's, so keep a margin rather than offer a
 * download the SDK will turn down. Same figures as `OfflineTilePacks` in the Swift app.
 */
export const TILE_PACK_LIMIT = 750;
export const TILE_PACK_BUDGET = 700;

/**
 * Average bytes one Outdoors tile pack takes, by the first zoom of its group, used to size an area
 * before it downloads. The Android SDK binding offers no size estimate, and a download takes whole
 * packs, so the picker counts packs. Measured from Outdoors tiles over Yosemite, the Lake District,
 * Shenandoah and Boulder (2026-11).
 */
export const BYTES_PER_PACK = Object.freeze({
  0: 33_400_000,
  6: 18_500_000,
  11: 2_100_000,
  15: 2_600_000,
} as const);

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
export function padBounds({
  bounds,
  fraction = 0.2,
}: {
  bounds: OfflineAreaBounds;
  fraction?: number;
}): OfflineAreaBounds {
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
export function tileRange({
  bounds,
  zoom,
}: {
  bounds: OfflineAreaBounds;
  zoom: number;
}): TileRange {
  const scale = 2 ** zoom;
  const last = scale - 1;
  const tile = (value: number) => clamp(Math.floor(value), 0, last);
  const x = (lon: number) => ((lon + 180) / 360) * scale;
  const y = (lat: number) => {
    const rad = (clamp(lat, -85.0511, 85.0511) * Math.PI) / 180;
    return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * scale;
  };
  return {
    minX: tile(x(bounds.west)),
    maxX: tile(x(bounds.east)),
    minY: tile(y(bounds.north)),
    maxY: tile(y(bounds.south)),
  };
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

/** The shape an area's tiles cover: a named region's outline, or its rectangle. */
export function areaRings(area: Pick<OfflineArea, 'bounds' | 'boundary'>): LonLat[][] {
  return area.boundary ?? [boundsRing(area.bounds)];
}

/**
 * The tile packs covering the rings at the given detail, as stable keys. Stops early past
 * `maxPacks`: by then the area is far over the limit and the exact count no longer matters.
 */
export function tilePacks({
  rings,
  detail,
  maxPacks = TILE_PACK_LIMIT * 4,
}: {
  rings: LonLat[][];
  detail: OfflineDetailLevel;
  maxPacks?: number;
}): Set<string> {
  const keys = new Set<string>();
  for (const [group, zoom] of INDEX_ZOOMS[detail]) {
    for (const tile of tilesCovering({ rings, zoom, maxTiles: maxPacks })) {
      keys.add(`${group}/${zoom}/${tile}`);
      if (keys.size > maxPacks) return keys;
    }
  }
  return keys;
}

/**
 * Whether the rings fit under the tile-pack cap alongside the areas already saved, and whether
 * they would fit on their own.
 */
export function packFit({
  rings,
  detail,
  saved,
}: {
  rings: LonLat[][];
  detail: OfflineDetailLevel;
  saved: Pick<OfflineArea, 'bounds' | 'boundary' | 'detail'>[];
}): { fits: boolean; fitsAlone: boolean } {
  const used = new Set<string>();
  for (const area of saved) {
    for (const key of tilePacks({ rings: areaRings(area), detail: area.detail })) used.add(key);
  }
  const adding = tilePacks({ rings, detail });
  let added = 0;
  for (const key of adding) if (!used.has(key)) added++;
  return {
    fits: used.size + added <= TILE_PACK_BUDGET,
    fitsAlone: adding.size <= TILE_PACK_BUDGET,
  };
}

/** Bytes the rings would take on disk at the given detail. */
export function estimateBytes({
  rings,
  detail,
}: {
  rings: LonLat[][];
  detail: OfflineDetailLevel;
}): number {
  let bytes = 0;
  for (const [group, zoom] of INDEX_ZOOMS[detail]) {
    bytes += tilesCovering({ rings, zoom }).size * BYTES_PER_PACK[group];
  }
  return bytes;
}

/**
 * Every tile at `zoom` the rings touch, as `x/y` keys: tiles any edge passes through, plus tiles
 * whose centre lies inside a ring (even-odd, so holes and islands sort themselves out). Stops early
 * past `maxTiles`. Same count as `OfflineTilePacks.tiles` in the Swift app.
 */
export function tilesCovering({
  rings,
  zoom,
  maxTiles = TILE_PACK_LIMIT * 4,
}: {
  rings: LonLat[][];
  zoom: number;
  maxTiles?: number;
}): Set<string> {
  const scale = 2 ** zoom;
  const last = scale - 1;
  const tiles = new Set<string>();
  const insert = ({ x, y }: TilePoint) => tiles.add(`${clamp(x, 0, last)}/${clamp(y, 0, last)}`);
  for (const ring of rings) {
    const points = ring.map((point) => project({ point, scale }));
    const edges = points.map((a, index) => [a, points[(index + 1) % points.length] ?? a] as const);
    for (const [a, b] of edges) {
      insertEdgeTiles({ a, b, insert });
      if (tiles.size > maxTiles) return tiles;
    }
    // Interior: for each row of tile centres, fill between the points where the ring crosses it.
    // A loop, not Math.min(...): a country's outline runs to more points than the stack holds.
    let top = Number.POSITIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;
    for (const point of points) {
      top = Math.min(top, point.y);
      bottom = Math.max(bottom, point.y);
    }
    const minY = Math.floor(top);
    const maxY = Math.floor(bottom);
    for (let y = minY + 1; y < maxY; y++) {
      const rowY = y + 0.5;
      const crossings: number[] = [];
      for (const [a, b] of edges) {
        if (a.y > rowY !== b.y > rowY)
          crossings.push(a.x + ((rowY - a.y) / (b.y - a.y)) * (b.x - a.x));
      }
      crossings.sort((left, right) => left - right);
      for (let pair = 0; pair + 1 < crossings.length; pair += 2) {
        const from = Math.ceil((crossings[pair] ?? 0) - 0.5);
        const to = Math.floor((crossings[pair + 1] ?? 0) - 0.5);
        for (let x = from; x <= to; x++) insert({ x, y });
        if (tiles.size > maxTiles) return tiles;
      }
    }
  }
  return tiles;
}

type TilePoint = { x: number; y: number };

/** Web Mercator tile space at the given scale (tiles across the world). */
function project({ point: [lon, lat], scale }: { point: LonLat; scale: number }): TilePoint {
  const rad = (clamp(lat, -85.0511, 85.0511) * Math.PI) / 180;
  return {
    x: ((lon + 180) / 360) * scale,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * scale,
  };
}

/**
 * Every tile an edge passes through, walked one grid line at a time (Amanatides and Woo). An edge
 * through a tile corner takes both tiles beside it, so the count errs high rather than letting an
 * area through.
 */
function insertEdgeTiles({
  a,
  b,
  insert,
}: {
  a: TilePoint;
  b: TilePoint;
  insert: (tile: TilePoint) => void;
}): void {
  let x = Math.floor(a.x);
  let y = Math.floor(a.y);
  const endX = Math.floor(b.x);
  const endY = Math.floor(b.y);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const deltaX = dx === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dx);
  const deltaY = dy === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dy);
  // How far along the edge (0...1) the next vertical and horizontal grid lines are.
  let nextX = dx === 0 ? Number.POSITIVE_INFINITY : (dx > 0 ? x + 1 - a.x : a.x - x) / Math.abs(dx);
  let nextY = dy === 0 ? Number.POSITIVE_INFINITY : (dy > 0 ? y + 1 - a.y : a.y - y) / Math.abs(dy);
  insert({ x, y });
  while (x !== endX || y !== endY) {
    if (y === endY || (x !== endX && nextX < nextY)) {
      x += stepX;
      nextX += deltaX;
    } else if (x === endX || nextY < nextX) {
      y += stepY;
      nextY += deltaY;
    } else {
      insert({ x: x + stepX, y });
      insert({ x, y: y + stepY });
      x += stepX;
      y += stepY;
      nextX += deltaX;
      nextY += deltaY;
    }
    insert({ x, y });
  }
}

export function totalBytes(areas: Pick<OfflineArea, 'sizeBytes'>[]): number {
  return areas.reduce((sum, area) => sum + area.sizeBytes, 0);
}

export function tripHasEnded({
  area,
  now,
}: {
  area: Pick<OfflineArea, 'tripEndsAt'>;
  now: number;
}): boolean {
  return area.tripEndsAt !== undefined && area.tripEndsAt < now;
}

/** Areas for finished trips first, so they are easy to clear out; then newest first. */
export function sortAreas({ areas, now }: { areas: OfflineArea[]; now: number }): OfflineArea[] {
  return [...areas].sort((a, b) => {
    const aEnded = tripHasEnded({ area: a, now });
    const bEnded = tripHasEnded({ area: b, now });
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
