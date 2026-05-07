import { z } from 'zod';

export const TripLocationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  name: z.string().optional(),
});

export const TripSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  location: TripLocationSchema.nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  userId: z.number().optional(),
  packId: z.string().nullable().optional(),
  deleted: z.boolean(),
  localCreatedAt: z.string().datetime().optional(),
  localUpdatedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});
