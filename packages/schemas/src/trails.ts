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
