import { authedFetch } from 'trails-app/lib/apiFetch';
import type { TrailSummaryWithCoords } from 'trails-app/lib/overpass';

export interface TrailSearchParams {
  q?: string;
  lat?: number;
  lon?: number;
  radius?: number;
  sport?: string;
  limit?: number;
  offset?: number;
}

export interface TrailSearchResult {
  trails: TrailSummaryWithCoords[];
  hasMore: boolean;
}

interface ApiTrail {
  osmId: string;
  name: string | null;
  sport: string | null;
  network: string | null;
  distance: string | null;
  difficulty: string | null;
  description: string | null;
  bbox: { coordinates?: number[][][][] } | null;
}

function bboxCenter(bbox: ApiTrail['bbox']): [number, number] | null {
  // bbox is GeoJSON Feature (ST_AsGeoJSON(ST_Envelope(geometry))) — extract centroid
  if (!bbox?.coordinates?.[0]) return null;
  const ring = bbox.coordinates[0];
  if (!ring) return null;
  // ring is [[minLon, minLat], [maxLon, minLat], [maxLon, maxLat], [minLon, maxLat], [minLon, minLat]]
  const lons = ring.flatMap((p) => (typeof p[0] === 'number' ? [p[0]] : []));
  const lats = ring.flatMap((p) => (typeof p[1] === 'number' ? [p[1]] : []));
  if (lons.length === 0 || lats.length === 0) return null;
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  return [(minLat + maxLat) / 2, (minLon + maxLon) / 2];
}

export async function searchTrails(params: TrailSearchParams): Promise<TrailSearchResult> {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.lat !== undefined) qs.set('lat', String(params.lat));
  if (params.lon !== undefined) qs.set('lon', String(params.lon));
  if (params.radius !== undefined) qs.set('radius', String(params.radius));
  if (params.sport) qs.set('sport', params.sport);
  qs.set('limit', String(params.limit ?? 20));
  if (params.offset) qs.set('offset', String(params.offset));

  const res = await authedFetch(`/api/trails/search?${qs.toString()}`);

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `Search failed: ${res.status}`);
  }

  const data = (await res.json()) as { trails: ApiTrail[]; hasMore: boolean };

  const trails: TrailSummaryWithCoords[] = data.trails.map((t) => ({
    osmId: t.osmId,
    name: t.name,
    sport: t.sport,
    network: t.network,
    distance: t.distance,
    difficulty: t.difficulty,
    description: t.description,
    bbox: null, // not needed client-side after we extract center
    center: bboxCenter(t.bbox),
  }));

  return { trails, hasMore: data.hasMore };
}
