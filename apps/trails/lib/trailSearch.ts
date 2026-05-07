import { asStringRecord } from '@packrat/guards';
import { AuthExpiredError, apiClient } from 'trails-app/lib/apiClient';
import type { TrailSummaryWithCoords } from 'trails-app/lib/overpass';

export { AuthExpiredError } from 'trails-app/lib/apiClient';

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

interface ApiBbox {
  coordinates?: number[][][][];
}

interface ApiTrail {
  osmId: string;
  name: string | null;
  sport: string | null;
  network: string | null;
  distance: string | null;
  difficulty: string | null;
  description: string | null;
  bbox: ApiBbox | null;
}

function bboxCenter(bbox: ApiTrail['bbox']): [number, number] | null {
  if (!bbox?.coordinates?.[0]) return null;
  const ring = bbox.coordinates[0];
  if (!ring) return null;
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
  const { data, error, status } = await apiClient.trails.search.get({
    query: {
      q: params.q,
      lat: params.lat,
      lon: params.lon,
      radius: params.radius,
      sport: params.sport,
      limit: params.limit ?? 20,
      offset: params.offset,
    },
  });

  if (status === 401) throw new AuthExpiredError();
  if (error || !data) {
    const msg = asStringRecord(error?.value)['message'];
    throw new Error(msg ?? `Search failed: ${status}`);
  }

  const trails: TrailSummaryWithCoords[] = (data.trails as ApiTrail[]).map((t) => ({
    osmId: t.osmId,
    name: t.name,
    sport: t.sport,
    network: t.network,
    distance: t.distance,
    difficulty: t.difficulty,
    description: t.description,
    bbox: null,
    center: bboxCenter(t.bbox),
  }));

  return { trails, hasMore: data.hasMore as boolean };
}
