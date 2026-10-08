import { z } from 'zod';

export const OsmMemberSchema = z.object({
  type: z.string(),
  ref: z.coerce.bigint(),
  role: z.string(),
});

export const RouteBaseRowSchema = z.object({
  osm_id: z.string(),
  name: z.string().nullable(),
  sport: z.string().nullable(),
  network: z.string().nullable(),
  distance: z.string().nullable(),
  difficulty: z.string().nullable(),
  description: z.string().nullable(),
});

export const RouteSearchRowSchema = RouteBaseRowSchema.extend({
  bbox: z.string().nullable(),
});

export const RouteDetailRowSchema = RouteBaseRowSchema.extend({
  members: z.array(OsmMemberSchema).nullable(),
  geojson: z.string().nullable(),
});

export type OsmMember = z.infer<typeof OsmMemberSchema>;
export type RouteSearchRow = z.infer<typeof RouteSearchRowSchema>;
export type RouteDetailRow = z.infer<typeof RouteDetailRowSchema>;

// ── Trail registry ─────────────────────────────────────────────────────────
// PackRat's own `trails` table on the trail database (see packages/trails-import).
// Ids are stable across imports, so trip logs and reports can point at them.

export const TrailSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  lengthMeters: z.number().int(),
  /** From the query point, when one was given. */
  distanceMeters: z.number().int().nullable(),
  /** [west, south, east, north]. */
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
});

export const TrailDetailSchema = TrailSummarySchema.omit({ distanceMeters: true }).extend({
  /** One Google encoded polyline (precision 5) per part of the trail. */
  lines: z.array(z.string()),
});

export const TrailMatchSchema = TrailSummarySchema.omit({ distanceMeters: true }).extend({
  /** Share of the trail's length the route passes along, 0–1. */
  coverage: z.number().min(0).max(1),
});

export const TrailSearchQuerySchema = z
  .object({
    q: z.string().trim().min(2).max(100).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lon: z.coerce.number().min(-180).max(180).optional(),
    radiusKm: z.coerce.number().positive().max(100).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .refine((v) => (v.lat === undefined) === (v.lon === undefined), {
    message: 'Give lat and lon together',
  })
  .refine((v) => v.q !== undefined || v.lat !== undefined, {
    message: 'Give q, or lat and lon',
  });

export const TrailMatchBodySchema = z.object({
  /** A Google encoded polyline (precision 5), as stored in a trip log. */
  route: z.string().min(4).max(100_000),
});

export type TrailSummary = z.infer<typeof TrailSummarySchema>;
export type TrailDetail = z.infer<typeof TrailDetailSchema>;
export type TrailMatch = z.infer<typeof TrailMatchSchema>;
export type TrailSearchQuery = z.infer<typeof TrailSearchQuerySchema>;
