import { queryOverpass, TrailQueryBuilder, toTrailSummary } from '@packrat/overpass';

export interface TrailSummaryWithCoords {
  osmId: string;
  name: string | null;
  sport: string | null;
  distance: string | null;
  difficulty: string | null;
  network: string | null;
  description: string | null;
  bbox: [number, number, number, number] | null;
  center: [number, number] | null;
}

export async function loadNearbyTrails(
  lat: number,
  lon: number,
): Promise<TrailSummaryWithCoords[]> {
  const ql = new TrailQueryBuilder().sport('hiking').around(lat, lon, 15_000).timeout(30).build();

  const result = await queryOverpass(ql);

  return result.elements.map((el) => {
    const summary = toTrailSummary(el);
    let center: [number, number] | null = null;
    if (summary.bbox) {
      const [west, south, east, north] = summary.bbox;
      center = [(south + north) / 2, (west + east) / 2];
    }
    return { ...summary, center };
  });
}
