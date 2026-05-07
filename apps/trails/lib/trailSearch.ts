import { asStringRecord, fromZod } from '@packrat/guards';
import { AuthExpiredError, apiClient } from 'trails-app/lib/apiClient';
import type { TrailSummaryWithCoords } from 'trails-app/lib/overpass';
import { z } from 'zod';

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
const ApiTrailSchema = z.object({
  osmId: z.string(),
  name: z.string().nullable(),
  sport: z.string().nullable(),
  network: z.string().nullable(),
  distance: z.string().nullable(),
  difficulty: z.string().nullable(),
  description: z.string().nullable(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable(),
});

type ApiTrail = z.infer<typeof ApiTrailSchema>;

const parseApiTrails = fromZod(z.array(ApiTrailSchema));

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

  // API returns a plain array of trail summaries; parse at runtime to validate shape
  const rawTrails = parseApiTrails(data) ?? [];
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
