import type { PredefinedRegion } from '../types';

/** Popular hiking regions available for offline download */
export const PREDEFINED_REGIONS: PredefinedRegion[] = [
  {
    id: 'great-smoky-mountains',
    name: 'Great Smoky Mountains',
    description: 'Most visited national park with extensive trail network',
    bounds: { minLat: 35.43, maxLat: 35.79, minLon: -83.93, maxLon: -83.1 },
    center: { latitude: 35.61, longitude: -83.52 },
    defaultMinZoom: 10,
    defaultMaxZoom: 15,
    sizeCategory: 'state-park',
  },
  {
    id: 'yosemite-national-park',
    name: 'Yosemite National Park',
    description: 'Iconic valley with waterfalls, granite cliffs, and scenic trails',
    bounds: { minLat: 37.49, maxLat: 38.19, minLon: -119.89, maxLon: -119.2 },
    center: { latitude: 37.84, longitude: -119.55 },
    defaultMinZoom: 10,
    defaultMaxZoom: 15,
    sizeCategory: 'state-park',
  },
  {
    id: 'grand-canyon-south-rim',
    name: 'Grand Canyon – South Rim',
    description: 'Iconic canyon trails including Bright Angel and South Kaibab',
    bounds: { minLat: 35.95, maxLat: 36.3, minLon: -112.3, maxLon: -111.95 },
    center: { latitude: 36.06, longitude: -112.14 },
    defaultMinZoom: 11,
    defaultMaxZoom: 15,
    sizeCategory: 'state-park',
  },
  {
    id: 'rocky-mountain-np',
    name: 'Rocky Mountain National Park',
    description: 'Alpine tundra, lakes, and wildlife along the Continental Divide',
    bounds: { minLat: 40.16, maxLat: 40.56, minLon: -105.92, maxLon: -105.49 },
    center: { latitude: 40.34, longitude: -105.68 },
    defaultMinZoom: 10,
    defaultMaxZoom: 15,
    sizeCategory: 'state-park',
  },
  {
    id: 'appalachian-trail-north-ga',
    name: 'Appalachian Trail – North Georgia',
    description: 'Springer Mountain to Unicoi Gap section',
    bounds: { minLat: 34.62, maxLat: 34.97, minLon: -84.2, maxLon: -83.68 },
    center: { latitude: 34.8, longitude: -83.9 },
    defaultMinZoom: 11,
    defaultMaxZoom: 15,
    sizeCategory: 'county',
  },
  {
    id: 'zion-national-park',
    name: 'Zion National Park',
    description: "Angels Landing, The Narrows, and Utah's canyon country",
    bounds: { minLat: 37.14, maxLat: 37.5, minLon: -113.23, maxLon: -112.84 },
    center: { latitude: 37.3, longitude: -113.05 },
    defaultMinZoom: 11,
    defaultMaxZoom: 15,
    sizeCategory: 'state-park',
  },
  {
    id: 'olympic-np',
    name: 'Olympic National Park',
    description: 'Diverse ecosystems from rainforest to coastline and glaciers',
    bounds: { minLat: 47.5, maxLat: 48.15, minLon: -124.7, maxLon: -123.4 },
    center: { latitude: 47.8, longitude: -123.9 },
    defaultMinZoom: 10,
    defaultMaxZoom: 14,
    sizeCategory: 'county',
  },
  {
    id: 'glacier-np',
    name: 'Glacier National Park',
    description: 'Going-to-the-Sun Road, alpine meadows, and pristine lakes',
    bounds: { minLat: 48.23, maxLat: 49.0, minLon: -114.47, maxLon: -113.25 },
    center: { latitude: 48.69, longitude: -113.72 },
    defaultMinZoom: 10,
    defaultMaxZoom: 14,
    sizeCategory: 'county',
  },
];

export type TileBounds = { minLat: number; maxLat: number; minLon: number; maxLon: number };
export type ZoomRange = { minZoom: number; maxZoom: number };

/**
 * Estimate tile count for a given bounding box and zoom range.
 * Formula: sum over zooms of (tiles_x * tiles_y) where each tile = 256×256 px.
 */
export function estimateTileCount(bounds: TileBounds, zoomRange: ZoomRange): number {
  let total = 0;
  for (let z = zoomRange.minZoom; z <= zoomRange.maxZoom; z++) {
    const factor = 2 ** z;
    const xMin = Math.floor(((bounds.minLon + 180) / 360) * factor);
    const xMax = Math.floor(((bounds.maxLon + 180) / 360) * factor);
    const latMinRad = (bounds.minLat * Math.PI) / 180;
    const latMaxRad = (bounds.maxLat * Math.PI) / 180;
    const yMin = Math.floor(
      ((1 - Math.log(Math.tan(latMaxRad) + 1 / Math.cos(latMaxRad)) / Math.PI) / 2) * factor,
    );
    const yMax = Math.floor(
      ((1 - Math.log(Math.tan(latMinRad) + 1 / Math.cos(latMinRad)) / Math.PI) / 2) * factor,
    );
    total += (xMax - xMin + 1) * (yMax - yMin + 1);
  }
  return total;
}

/**
 * Average bytes per compressed vector tile.
 * Based on typical Mapbox/OpenMapTiles vector tile sizes for terrain-heavy regions
 * (measured across popular hiking areas at mid-zoom levels).
 */
const BYTES_PER_TILE = 7_500;

/**
 * Estimate download size in bytes.
 */
export function estimateDownloadSize(bounds: TileBounds, zoomRange: ZoomRange): number {
  return estimateTileCount(bounds, zoomRange) * BYTES_PER_TILE;
}

/** Format bytes to a human-readable string */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
