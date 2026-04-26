import type { createOsmDb } from '@packrat/api/db';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

const OsmMemberSchema = z.object({
  type: z.string(),
  ref: z.number(),
  role: z.string(),
});

export type OsmMember = z.infer<typeof OsmMemberSchema>;

/**
 * Stitches a MultiLineString geometry from member way IDs using ST_LineMerge.
 * Used when an osm_routes row has NULL geometry (osm2pgsql left it unbuilt).
 * Order is preserved via unnest WITH ORDINALITY.
 *
 * Limitation: osm_ways only stores trail-classified ways (hiking paths,
 * cycleways, piste ways). Road-based cycling routes (ncn/rcn) include road
 * segments (highway=primary/secondary) that are not in osm_ways, so stitching
 * will return null for those routes. This only affects the rare null-geometry
 * fallback path — osm2pgsql assembles geometry for >99% of routes directly.
 */
export async function stitchRouteGeometry(
  db: ReturnType<typeof createOsmDb>,
  members: OsmMember[],
): Promise<unknown> {
  const wayRefs = members.filter((m) => m.type === 'w').map((m) => m.ref);
  if (wayRefs.length === 0) return null;

  const arrayLiteral = sql.join(
    wayRefs.map((ref) => sql`${ref}`),
    sql`, `,
  );

  const result = await db.execute(sql`
    SELECT ST_AsGeoJSON(
      ST_LineMerge(
        ST_Collect(geometry ORDER BY ordinality)
      )
    ) AS geojson
    FROM osm_ways
    JOIN unnest(
      ARRAY[${arrayLiteral}]::bigint[]
    ) WITH ORDINALITY AS t(osm_id, ordinality)
      USING (osm_id)
    WHERE geometry IS NOT NULL
  `);

  const row = z
    .object({ geojson: z.string().nullable() })
    .nullable()
    .parse(result.rows?.[0] ?? null);
  if (!row?.geojson) return null;

  try {
    return JSON.parse(row.geojson);
  } catch {
    return null;
  }
}
