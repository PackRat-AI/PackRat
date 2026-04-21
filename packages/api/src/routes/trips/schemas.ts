import { z } from '@hono/zod-openapi';

export const LocationSchema = z
  .object({
    latitude: z.number(),
    longitude: z.number(),
    name: z.string().optional(),
  })
  .nullable()
  .optional();

export const TripSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    location: LocationSchema,
    startDate: z.string().datetime().nullable().optional(),
    endDate: z.string().datetime().nullable().optional(),
    notes: z.string().nullable().optional(),
    userId: z.number(),
    packId: z.string().nullable().optional(),
    deleted: z.boolean(),
    localCreatedAt: z.string().datetime(),
    localUpdatedAt: z.string().datetime(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('Trip');

export const TripWithPackSchema = TripSchema.openapi('TripWithPack');

export const CreateTripRequestSchema = z.object({
  id: z.string().openapi({ example: 't_123456', description: 'Client-generated trip ID' }),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  location: LocationSchema,
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  packId: z.string().optional().nullable(),
  localCreatedAt: z.string().datetime(),
  localUpdatedAt: z.string().datetime(),
});
