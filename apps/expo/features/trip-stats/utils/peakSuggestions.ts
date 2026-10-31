import type { NearbyPeak } from '@packrat/schemas/tripStats';
import { clamp } from '@packrat/utils';
import { type Coordinate, distanceMeters, sampleRoute } from './polyline';

/**
 * Close enough to call a summit "on the route": a GPS track and an OSM summit node rarely
 * coincide, and a short spur to the top is common.
 */
export const ON_ROUTE_METERS = 250;

/** Routes hold up to ~1,500 points; this many keeps ranking 200 peaks instant. */
const ROUTE_SAMPLE_LIMIT = 400;

export interface PeakSuggestion {
  peak: NearbyPeak;
  /** From the nearest route point, or from the centre with no route. */
  distanceMeters: number;
  isOnRoute: boolean;
}

/**
 * Ranks nearby peaks for the summit picker: the ones the route passes over first, in route
 * order, then the rest nearest first (higher first on a tie).
 */
export function rankPeaks({
  peaks,
  route,
  center,
}: {
  peaks: readonly NearbyPeak[];
  route: readonly Coordinate[];
  center: Coordinate;
}): { onRoute: PeakSuggestion[]; nearby: PeakSuggestion[] } {
  const samples = sampleRoute({ route, limit: ROUTE_SAMPLE_LIMIT });
  const onRoute: { item: PeakSuggestion; index: number }[] = [];
  const nearby: PeakSuggestion[] = [];
  for (const peak of peaks) {
    if (samples.length < 2) {
      nearby.push({
        peak,
        distanceMeters: distanceMeters({ from: center, to: peak }),
        isOnRoute: false,
      });
      continue;
    }
    let best = { distance: Number.POSITIVE_INFINITY, index: 0 };
    samples.forEach((sample, index) => {
      const distance = distanceMeters({ from: sample, to: peak });
      if (distance < best.distance) best = { distance, index };
    });
    if (best.distance <= ON_ROUTE_METERS) {
      onRoute.push({
        item: { peak, distanceMeters: best.distance, isOnRoute: true },
        index: best.index,
      });
    } else {
      nearby.push({ peak, distanceMeters: best.distance, isOnRoute: false });
    }
  }
  return {
    onRoute: onRoute.sort((a, b) => a.index - b.index).map((entry) => entry.item),
    nearby: nearby.sort(
      (a, b) =>
        a.distanceMeters - b.distanceMeters ||
        (b.peak.elevationMeters ?? 0) - (a.peak.elevationMeters ?? 0),
    ),
  };
}

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/**
 * The box to ask the API for: the route's extent (or a point's surroundings), padded, clamped to
 * the API's 1° × 1.5° ceiling, and snapped outward to 0.01° so nearby requests share the edge
 * cache.
 */
export function peakSearchBox(points: readonly Coordinate[]): BoundingBox | null {
  if (points.length === 0) return null;
  const lats = points.map((point) => point.latitude);
  const lngs = points.map((point) => point.longitude);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const latSpan = clamp((Math.max(...lats) - Math.min(...lats)) * 1.2, 0.02, 0.98);
  const lngSpan = clamp((Math.max(...lngs) - Math.min(...lngs)) * 1.2, 0.02, 1.48);
  const snapDown = (value: number) => Math.floor(value * 100) / 100;
  const snapUp = (value: number) => Math.ceil(value * 100) / 100;
  return {
    south: clamp(snapDown(midLat - latSpan / 2), -90, 90),
    north: clamp(snapUp(midLat + latSpan / 2), -90, 90),
    west: clamp(snapDown(midLng - lngSpan / 2), -180, 180),
    east: clamp(snapUp(midLng + lngSpan / 2), -180, 180),
  };
}
