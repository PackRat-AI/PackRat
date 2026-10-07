import { type OverpassElement, queryOverpass } from '@packrat/overpass';
import type { NearbyPeak } from '@packrat/schemas/tripStats';

/** Enough to pick from without flooding a sheet; the highest come first. */
export const NEARBY_PEAKS_LIMIT = 200;

const FEET_PER_METRE = 3.28084;
const ELEVATION = /^(-?\d+(?:\.\d+)?)\s*(m|ft|feet|'|)$/;

export interface PeakBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/**
 * Reads an OSM `ele` tag. The convention is plain metres ("4421"), but the
 * wild holds "4421 m", "14505 ft", "14,505'" and "4421;4418". Anything
 * unreadable is null rather than a guess.
 */
export function parseElevation(raw: string | undefined): number | null {
  if (!raw) return null;
  const first = raw.split(';')[0]?.trim().toLowerCase() ?? '';
  const match = first.replace(/,/g, '').match(ELEVATION);
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  const isFeet = match[2] === 'ft' || match[2] === 'feet' || match[2] === "'";
  return Math.round((isFeet ? value / FEET_PER_METRE : value) * 10) / 10;
}

export function toNearbyPeak(element: OverpassElement): NearbyPeak | null {
  const name = element.tags?.name?.trim();
  if (element.type !== 'node' || !name || element.lat == null || element.lon == null) return null;
  return {
    osmId: element.id,
    name,
    elevationMeters: parseElevation(element.tags?.ele),
    latitude: element.lat,
    longitude: element.lon,
  };
}

export function buildPeaksQuery({ south, west, north, east }: PeakBounds): string {
  return `[out:json][timeout:20];node["natural"="peak"]["name"](${south},${west},${north},${east});out body;`;
}

/** Highest first; unknown heights last, then by name. */
export function sortPeaks(peaks: NearbyPeak[]): NearbyPeak[] {
  return [...peaks].sort((a, b) => {
    if (a.elevationMeters !== b.elevationMeters) {
      return (b.elevationMeters ?? -Infinity) - (a.elevationMeters ?? -Infinity);
    }
    return a.name.localeCompare(b.name);
  });
}

/** Peaks hardly move; a week keeps Overpass load low and lookups instant. */
export const PEAKS_CACHE_SECONDS = 7 * 24 * 60 * 60;

/** 0.01° ≈ 1 km: boxes a pan apart share a cache entry. */
const GRID = 100;

/**
 * Widens `bounds` out to the 0.01° grid so nearby lookups ask the same
 * question, and so share one cached answer.
 */
export function snapBounds({ south, west, north, east }: PeakBounds): PeakBounds {
  const down = (v: number) => Math.floor(v * GRID) / GRID;
  const up = (v: number) => Math.ceil(v * GRID) / GRID;
  return { south: down(south), west: down(west), north: up(north), east: up(east) };
}

export function peaksCacheKey(bounds: PeakBounds): string {
  const { south, west, north, east } = snapBounds(bounds);
  return `https://cache.packrat.internal/trip-stats/peaks/${south},${west},${north},${east}`;
}

/** The Workers edge cache, absent under Node (unit tests) and so skipped there. */
function edgeCache(): Cache | undefined {
  const storage = (globalThis as { caches?: CacheStorage & { default?: Cache } }).caches;
  return storage?.default;
}

/**
 * Named peaks inside `bounds`, from OpenStreetMap through Overpass, cached at
 * the edge for a week per snapped box. The public instance answers 504 when
 * busy and usually succeeds straight after, so one failure gets one retry.
 */
export async function findNearbyPeaks(bounds: PeakBounds): Promise<NearbyPeak[]> {
  const cache = edgeCache();
  const key = peaksCacheKey(bounds);
  const hit = await cache?.match(key);
  if (hit) return (await hit.json()) as NearbyPeak[];

  const peaks = await fetchNearbyPeaks(snapBounds(bounds));
  await cache?.put(
    key,
    new Response(JSON.stringify(peaks), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${PEAKS_CACHE_SECONDS}`,
      },
    }),
  );
  return peaks;
}

async function fetchNearbyPeaks(bounds: PeakBounds): Promise<NearbyPeak[]> {
  const ql = buildPeaksQuery(bounds);
  const response = await queryOverpass({ ql }).catch(() => queryOverpass({ ql }));
  const peaks = response.elements.flatMap((element) => {
    const peak = toNearbyPeak(element);
    return peak ? [peak] : [];
  });
  return sortPeaks(peaks).slice(0, NEARBY_PEAKS_LIMIT);
}
