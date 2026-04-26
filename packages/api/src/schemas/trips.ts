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

export const CreateTripBodySchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  location: TripLocationSchema.nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  packId: z.string().nullable().optional(),
  localCreatedAt: z.string().datetime(),
  localUpdatedAt: z.string().datetime(),
});

export const UpdateTripBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  location: TripLocationSchema.nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  packId: z.string().nullable().optional(),
  localUpdatedAt: z.string().datetime().optional(),
});

export type TripLocation = z.infer<typeof TripLocationSchema>;
export type Trip = z.infer<typeof TripSchema>;
