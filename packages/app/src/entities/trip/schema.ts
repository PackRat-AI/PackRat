import { z } from 'zod';
import { dateField } from '../../shared/lib/date';

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
  localCreatedAt: dateField.optional(),
  localUpdatedAt: dateField.optional(),
  createdAt: dateField.optional(),
  updatedAt: dateField.optional(),
});
