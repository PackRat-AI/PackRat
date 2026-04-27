import { z } from 'zod';

const OverpassNodeGeomSchema = z.object({ lat: z.number(), lon: z.number() });

const OverpassMemberSchema = z.object({
  type: z.enum(['node', 'way', 'relation']),
  ref: z.number(),
  role: z.string(),
  geometry: z.array(OverpassNodeGeomSchema).optional(),
});

const OverpassBoundsSchema = z.object({
  minlat: z.number(),
  minlon: z.number(),
  maxlat: z.number(),
  maxlon: z.number(),
});

const OverpassElementSchema = z.object({
  type: z.enum(['node', 'way', 'relation']),
  id: z.number(),
  tags: z.record(z.string()).optional(),
  members: z.array(OverpassMemberSchema).optional(),
  bounds: OverpassBoundsSchema.optional(),
  geometry: z.array(OverpassNodeGeomSchema).optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
});

export const OverpassResponseSchema = z.object({
  version: z.number(),
  generator: z.string(),
  osm3s: z.object({
    timestamp_osm_base: z.string(),
    copyright: z.string(),
  }),
  elements: z.array(OverpassElementSchema),
});
