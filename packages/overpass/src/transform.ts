import type { OverpassElement, OverpassNodeGeom } from './types';

const OSM_ROUTE_TO_SPORT: Record<string, string> = {
  hiking: 'hiking',
  bicycle: 'cycling',
  ski: 'skiing',
  running: 'running',
  horse_riding: 'horse_riding',
};

export interface TrailSummary {
  osmId: string;
  name: string | null;
  sport: string | null;
  network: string | null;
  distance: string | null;
  difficulty: string | null;
  description: string | null;
  bbox: [number, number, number, number] | null;
}

export interface TrailDetail extends TrailSummary {
  geometry: GeoJsonGeometry | null;
}

interface GeoJsonLineString {
  type: 'LineString';
  coordinates: [number, number][];
}

interface GeoJsonMultiLineString {
  type: 'MultiLineString';
  coordinates: [number, number][][];
}

type GeoJsonGeometry = GeoJsonLineString | GeoJsonMultiLineString;

export function toTrailSummary(element: OverpassElement): TrailSummary {
  const tags = element.tags ?? {};
  const b = element.bounds;

  return {
    osmId: String(element.id),
    name: tags.name ?? null,
    sport: tags.route ? (OSM_ROUTE_TO_SPORT[tags.route] ?? tags.route) : null,
    network: tags.network ?? null,
    distance: tags.distance ?? tags.length ?? null,
    difficulty: tags.difficulty ?? tags.sac_scale ?? tags['mtb:scale'] ?? null,
    description: tags.description ?? null,
    bbox: b ? [b.minlon, b.minlat, b.maxlon, b.maxlat] : null,
  };
}

export function toTrailGeometry(element: OverpassElement): GeoJsonGeometry | null {
  const ways = (element.members ?? []).filter(
    (m) => m.type === 'way' && Array.isArray(m.geometry) && m.geometry.length > 0,
  );

  if (ways.length === 0) return null;

  const lineStrings = ways.map((m) =>
    // safe-cast: way elements always have geometry as OverpassNodeGeom[] per Overpass API contract
    (m.geometry as OverpassNodeGeom[]).map((pt): [number, number] => [pt.lon, pt.lat]),
  );

  if (lineStrings.length === 1) {
    return { type: 'LineString', coordinates: lineStrings[0] };
  }

  return { type: 'MultiLineString', coordinates: lineStrings };
}

export function toTrailDetail(element: OverpassElement): TrailDetail {
  return {
    ...toTrailSummary(element),
    geometry: toTrailGeometry(element),
  };
}
