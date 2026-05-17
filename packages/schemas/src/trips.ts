import { z } from 'zod';
import { datetimeString } from './utils';

const nullableDateString = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString() : v),
  z.string().nullable(),
);

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
  startDate: nullableDateString.optional(),
  endDate: nullableDateString.optional(),
  userId: z.string().optional(),
  packId: z.string().nullable().optional(),
  deleted: z.boolean(),
  localCreatedAt: datetimeString.optional(),
  localUpdatedAt: datetimeString.optional(),
  createdAt: datetimeString.optional(),
  updatedAt: datetimeString.optional(),
});

export type Trip = z.infer<typeof TripSchema>;

export const CreateTripBodySchema = z.object({
  // id optional — server mints if absent (lean callers). Offline-first
  // stores keep supplying client-side IDs for sync. min(1) rejects ''.
  id: z.string().trim().min(1).optional(),
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
