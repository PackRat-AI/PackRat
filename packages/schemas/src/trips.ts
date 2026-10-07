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

/** One task on a trip's "Before you go" list — a permit, pass or reservation. */
export const TripChecklistItemSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200),
  done: z.boolean(),
});

const TripChecklistSchema = z.array(TripChecklistItemSchema).max(50);

export const TripStatusSchema = z.enum(['planned', 'in_progress', 'complete']);

/** The route a user intends to follow, e.g. an imported GPX track. */
export const TripPlannedRouteSchema = z
  .array(z.object({ latitude: z.number(), longitude: z.number() }))
  .max(20000);

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
  checklist: TripChecklistSchema.nullable().optional(),
  status: TripStatusSchema.optional(),
  startedAt: nullableDateString.optional(),
  completedAt: nullableDateString.optional(),
  plannedRoute: TripPlannedRouteSchema.nullable().optional(),
  deleted: z.boolean(),
  localCreatedAt: datetimeString.optional(),
  localUpdatedAt: datetimeString.optional(),
  createdAt: datetimeString.optional(),
  updatedAt: datetimeString.optional(),
});

export type Trip = z.infer<typeof TripSchema>;

export const CreateTripBodySchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  location: TripLocationSchema.nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  packId: z.string().nullable().optional(),
  checklist: TripChecklistSchema.nullable().optional(),
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
  checklist: TripChecklistSchema.nullable().optional(),
  status: TripStatusSchema.optional(),
  startedAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  plannedRoute: TripPlannedRouteSchema.nullable().optional(),
  localUpdatedAt: z.string().datetime().optional(),
});

export type TripLocation = z.infer<typeof TripLocationSchema>;
export type TripChecklistItem = z.infer<typeof TripChecklistItemSchema>;
export type TripStatus = z.infer<typeof TripStatusSchema>;
export type TripPlannedRoute = z.infer<typeof TripPlannedRouteSchema>;
