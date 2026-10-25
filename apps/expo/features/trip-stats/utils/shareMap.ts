import type { Coordinate } from './polyline';

/**
 * The narrowest a shared map gets unless the user zooms in close: wide enough to show a region,
 * too wide to pick out a trailhead or a home. The same 150 km the Swift app holds.
 */
export const PRIVATE_SPAN_METRES = 150_000;

const METRES_PER_DEGREE = 111_320;

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/**
 * The region a shared map shows: every point with room around it, at least `minSpanMetres`
 * across, then widened to the frame's shape (width over height) so nothing is cropped.
 */
export function shareMapRegion({
  points,
  aspect,
  minSpanMetres,
}: {
  points: readonly Coordinate[];
  aspect: number;
  minSpanMetres: number;
}): MapRegion | null {
  if (points.length === 0) return null;
  const lats = points.map((point) => point.latitude);
  const lngs = points.map((point) => point.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latitude = (minLat + maxLat) / 2;
  const longitude = (minLng + maxLng) / 2;
  const lngScale = Math.max(Math.cos((latitude * Math.PI) / 180), 0.01);

  // Spans in metres, padded as the Swift snapshot pads them: 15% of the larger side plus 2 km.
  let height = (maxLat - minLat) * METRES_PER_DEGREE;
  let width = (maxLng - minLng) * METRES_PER_DEGREE * lngScale;
  const padding = Math.max(width, height) * 0.15 + 2_000;
  height = Math.max(height + padding * 2, minSpanMetres);
  width = Math.max(width + padding * 2, minSpanMetres);
  if (width / height < aspect) width = height * aspect;
  else height = width / aspect;

  return {
    latitude,
    longitude,
    latitudeDelta: height / METRES_PER_DEGREE,
    longitudeDelta: width / (METRES_PER_DEGREE * lngScale),
  };
}
