import { z } from 'zod';
import { TripSummitSchema } from './trips';
import { datetimeString } from './utils';

const nullableDateString = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString() : v),
  z.string().nullable(),
);

export const TripGoalKindSchema = z.enum(['annual', 'custom', 'longTrail', 'peakList', 'parkList']);
export const TripGoalMetricSchema = z.enum([
  'trips',
  'nights',
  'days',
  'distance',
  'elevation',
  'summits',
  'parks',
]);
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
  trailCode: z.string().nullable().optional(),
  peaks: z.array(TripSummitSchema).nullable().optional(),
  parkCodes: z.array(z.string()).nullable().optional(),
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
  trailCode: z.string().trim().min(1).max(16).nullable().optional(),
  peaks: z.array(TripSummitSchema).max(500).nullable().optional(),
  parkCodes: z.array(z.string().trim().min(1).max(16)).max(100).nullable().optional(),
};

/**
 * An annual goal names its year; a custom goal names its window. A list goal
 * counts every trip ever, so its dates are optional, but it names what it
 * lists: a long-trail goal its trail, a peak list at least one peak. Checked
 * here so a goal the stats screen could never place is refused at the door.
 */
function isPlaceable(goal: {
  kind: string;
  year?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  trailCode?: string | null;
  peaks?: unknown[] | null;
}) {
  const ordered =
    !goal.startDate || !goal.endDate || new Date(goal.startDate) <= new Date(goal.endDate);
  switch (goal.kind) {
    case 'annual':
      return goal.year != null;
    case 'custom':
      return !!goal.startDate && !!goal.endDate && ordered;
    case 'longTrail':
      return !!goal.trailCode && ordered;
    case 'peakList':
      return (goal.peaks?.length ?? 0) > 0 && ordered;
    default:
      return ordered;
  }
}

const placeableMessage =
  'Annual goals need a year; custom goals need a start date before the end date; ' +
  'long-trail goals need a trailCode; peak lists need at least one peak';

export const CreateTripGoalBodySchema = z
  .object({
    id: z.string().min(1),
    ...goalFields,
    localCreatedAt: z.string().datetime(),
    localUpdatedAt: z.string().datetime(),
  })
  .refine(isPlaceable, { message: placeableMessage });

/** Full replace: clients always send the whole goal, so the window check still holds. */
export const UpdateTripGoalBodySchema = z
  .object({
    ...goalFields,
    localUpdatedAt: z.string().datetime().optional(),
  })
  .refine(isPlaceable, { message: placeableMessage });

/** `enabled` is null until the user answers the opt-in. */
export const TripStatsSettingsSchema = z.object({
  enabled: z.boolean().nullable(),
  breakReason: TripBreakReasonSchema.nullable().optional(),
  breakReasonTripId: z.string().nullable().optional(),
});

export const TripStatsEntryKindSchema = z.enum(['park', 'summit']);

/** See `tripStatsEntries` in `@packrat/db/schema`: a park visit or summit added by hand. */
export const TripStatsEntrySchema = z.object({
  id: z.string(),
  kind: TripStatsEntryKindSchema,
  parkCode: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  elevationMeters: z.number().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  osmId: z.number().int().nullable().optional(),
  date: nullableDateString.optional(),
  deleted: z.boolean(),
  localCreatedAt: datetimeString.optional(),
  localUpdatedAt: datetimeString.optional(),
  createdAt: datetimeString.optional(),
  updatedAt: datetimeString.optional(),
});

const entryFields = {
  kind: TripStatsEntryKindSchema,
  parkCode: z.string().trim().min(1).max(16).nullable().optional(),
  name: z.string().trim().max(200).nullable().optional(),
  elevationMeters: z.number().min(-500).max(9000).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  osmId: z.number().int().nullable().optional(),
  date: z.string().nullable().optional(),
};

/** A park visit names its park; a summit names its peak. */
function isComplete(entry: { kind: string; parkCode?: string | null; name?: string | null }) {
  return entry.kind === 'park' ? !!entry.parkCode : !!entry.name?.trim();
}

const completeMessage = 'Park visits need a parkCode; summits need a name';

export const CreateTripStatsEntryBodySchema = z
  .object({
    id: z.string().min(1),
    ...entryFields,
    localCreatedAt: z.string().datetime(),
    localUpdatedAt: z.string().datetime(),
  })
  .refine(isComplete, { message: completeMessage });

/** Full replace, like goals. */
export const UpdateTripStatsEntryBodySchema = z
  .object({ ...entryFields, localUpdatedAt: z.string().datetime().optional() })
  .refine(isComplete, { message: completeMessage });

/** A named peak from OpenStreetMap, offered when logging the summits of a trip. */
export const NearbyPeakSchema = z.object({
  osmId: z.number().int(),
  name: z.string(),
  elevationMeters: z.number().nullable(),
  latitude: z.number(),
  longitude: z.number(),
});

export const NearbyPeaksQuerySchema = z
  .object({
    south: z.coerce.number().min(-90).max(90),
    west: z.coerce.number().min(-180).max(180),
    north: z.coerce.number().min(-90).max(90),
    east: z.coerce.number().min(-180).max(180),
  })
  .refine((b) => b.south < b.north && b.west < b.east, { message: 'Empty bounding box' })
  // About 110 km on a side: room for a long route, small enough for Overpass.
  .refine((b) => b.north - b.south <= 1 && b.east - b.west <= 1.5, {
    message: 'Bounding box too large',
  });

export type TripStatsEntry = z.infer<typeof TripStatsEntrySchema>;
export type NearbyPeak = z.infer<typeof NearbyPeakSchema>;
export type TripGoal = z.infer<typeof TripGoalSchema>;
export type TripGoalMetric = z.infer<typeof TripGoalMetricSchema>;
export type TripStatsSettings = z.infer<typeof TripStatsSettingsSchema>;
