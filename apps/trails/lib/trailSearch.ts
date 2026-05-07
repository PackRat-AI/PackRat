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

// API returns toTrailSummary shape: bbox is [minlon, minlat, maxlon, maxlat] (west/south/east/north)
interface ApiTrail {
  osmId: string;
  name: string | null;
  sport: string | null;
  network: string | null;
  distance: string | null;
  difficulty: string | null;
  description: string | null;
  bbox: [number, number, number, number] | null;
}

function bboxCenter(bbox: ApiTrail['bbox']): [number, number] | null {
  if (!bbox) return null;
  const [west, south, east, north] = bbox;
  return [(south + north) / 2, (west + east) / 2];
}

export async function searchTrails(params: TrailSearchParams): Promise<TrailSearchResult> {
  const limit = params.limit ?? 20;
  const { data, error, status } = await apiClient.trails.search.get({
    query: {
      q: params.q,
      lat: params.lat,
      lon: params.lon,
      radius: params.radius,
      sport: params.sport,
      limit,
      offset: params.offset,
    },
  });

  if (status === 401) throw new AuthExpiredError();
  if (error || !data) {
    const rec = asStringRecord(error?.value);
    const msg = rec.error ?? rec.message;
    throw new Error(msg ?? `Search failed: ${status}`);
  }

  // API returns a plain array of trail summaries
  const rawTrails = data as unknown as ApiTrail[];
  const trails: TrailSummaryWithCoords[] = rawTrails.map((t) => ({
    osmId: t.osmId,
    name: t.name,
    sport: t.sport,
    network: t.network,
    distance: t.distance,
    difficulty: t.difficulty,
    description: t.description,
    bbox: t.bbox,
    center: bboxCenter(t.bbox),
  }));

  return { trails, hasMore: trails.length >= limit };
}
