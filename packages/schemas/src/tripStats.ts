import { z } from 'zod';
import { datetimeString } from './utils';

const nullableDateString = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString() : v),
  z.string().nullable(),
);

export const TripGoalKindSchema = z.enum(['annual', 'custom']);
export const TripGoalMetricSchema = z.enum(['trips', 'nights', 'days', 'distance', 'elevation']);
export const TripBreakReasonSchema = z.enum(['injury', 'illness', 'life', 'season']);

/** See `tripGoals` in `@packrat/db/schema`: targets are counts or metres. */
export const TripGoalSchema = z.object({
  id: z.string(),
  kind: TripGoalKindSchema,
  metric: TripGoalMetricSchema,
  target: z.number(),
  year: z.number().int().nullable().optional(),
  name: z.string().nullable().optional(),
  startDate: nullableDateString.optional(),
  endDate: nullableDateString.optional(),
  deleted: z.boolean(),
  localCreatedAt: datetimeString.optional(),
  localUpdatedAt: datetimeString.optional(),
  createdAt: datetimeString.optional(),
  updatedAt: datetimeString.optional(),
});

const goalFields = {
  kind: TripGoalKindSchema,
  metric: TripGoalMetricSchema,
  target: z.number().positive(),
  year: z.number().int().min(1900).max(3000).nullable().optional(),
  name: z.string().trim().max(120).nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
};

/**
 * An annual goal names its year; a custom goal names its window. Checked here so
 * a goal the stats screen could never place is refused at the door.
 */
function hasWindow(goal: {
  kind: string;
  year?: number | null;
  startDate?: string | null;
  endDate?: string | null;
}) {
  if (goal.kind === 'annual') return goal.year != null;
  if (!goal.startDate || !goal.endDate) return false;
  return new Date(goal.startDate) <= new Date(goal.endDate);
}

const windowMessage =
  'Annual goals need a year; custom goals need a start date before the end date';

export const CreateTripGoalBodySchema = z
  .object({
    id: z.string().min(1),
    ...goalFields,
    localCreatedAt: z.string().datetime(),
    localUpdatedAt: z.string().datetime(),
  })
  .refine(hasWindow, { message: windowMessage });

/** Full replace: clients always send the whole goal, so the window check still holds. */
export const UpdateTripGoalBodySchema = z
  .object({
    ...goalFields,
    localUpdatedAt: z.string().datetime().optional(),
  })
  .refine(hasWindow, { message: windowMessage });

/** `enabled` is null until the user answers the opt-in. */
export const TripStatsSettingsSchema = z.object({
  enabled: z.boolean().nullable(),
  breakReason: TripBreakReasonSchema.nullable().optional(),
  breakReasonTripId: z.string().nullable().optional(),
});

export type TripGoal = z.infer<typeof TripGoalSchema>;
export type TripGoalMetric = z.infer<typeof TripGoalMetricSchema>;
export type TripStatsSettings = z.infer<typeof TripStatsSettingsSchema>;
