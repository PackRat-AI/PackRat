import type { Coordinate } from './polyline';

/**
 * The narrowest a shared map gets unless the user zooms in close: wide enough to show a region,
 * too wide to pick out a trailhead or a home. The same 150 km the Swift app holds.
 */
export const PRIVATE_SPAN_METRES = 150_000;

const EARTH_RADIUS_METRES = 6_378_137;
// Web Mercator stops here; beyond it the projection runs to infinity.
const MAX_LATITUDE = 85;
const TAU = Math.PI * 2;

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;
const clampLatitude = (latitude: number) =>
  Math.min(Math.max(latitude, -MAX_LATITUDE), MAX_LATITUDE);
const mercatorY = (latitude: number) =>
  Math.log(Math.tan(Math.PI / 4 + toRadians(clampLatitude(latitude)) / 2));
const latitudeAt = (y: number) => toDegrees(2 * Math.atan(Math.exp(y)) - Math.PI / 2);

/**
 * The region that shows every point centred in a frame of the given shape (width over height).
 *
 * The maths is done in Web Mercator, the projection Google Maps draws in, so the frame is centred
 * on screen and nothing falls off an edge; averaging and padding in degrees drifts badly once the
 * points span many degrees of latitude. The bounds come back as a region whose edges are exactly the
 * frame's edges, which react-native-maps fits to the view.
 *
 * - `minSpanMetres`: the frame is never narrower than this, so a lone point shows a region.
 * - `topInset`: extra room above the points, as a fraction of the height, for pins that stand up
 *   from their coordinate.
 */
export function fitMapRegion({
  points,
  aspect,
  minSpanMetres,
  topInset = 0,
}: {
  points: readonly Coordinate[];
  aspect: number;
  minSpanMetres: number;
  topInset?: number;
}): MapRegion | null {
  if (points.length === 0) return null;
  const xs = points.map((point) => toRadians(point.longitude));
  const ys = points.map((point) => mercatorY(point.latitude));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const centreY = (minY + maxY) / 2;
  // Metres to projected units at the frame's centre (Mercator's scale grows with 1 / cos latitude).
  const perMetre = 1 / (EARTH_RADIUS_METRES * Math.cos(toRadians(latitudeAt(centreY))));

  // Padded as the Swift snapshot pads: 15% of the larger side plus 2 km.
  const padding = Math.max(maxX - minX, maxY - minY) * 0.15 + 2_000 * perMetre;
  let width = Math.max(maxX - minX + padding * 2, minSpanMetres * perMetre);
  let height = Math.max(maxY - minY + padding * 2, minSpanMetres * perMetre);
  // Room for pins above the top point, then the frame's shape, widening whichever side is short.
  const top = height * topInset;
  height += top;
  if (width / height < aspect) width = height * aspect;
  else height = width / aspect;
  width = Math.min(width, TAU);

  const middleY = centreY + top / 2;
  const north = latitudeAt(middleY + height / 2);
  const south = latitudeAt(middleY - height / 2);
  return {
    latitude: (north + south) / 2,
    longitude: toDegrees((minX + maxX) / 2),
    latitudeDelta: north - south,
    longitudeDelta: toDegrees(width),
  };
}
