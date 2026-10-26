import { z } from 'zod';

const datetimeString = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString() : v),
  z.string().datetime(),
);

export const TrailSurfaceSchema = z.enum(['paved', 'gravel', 'dirt', 'rocky', 'snow', 'mud']);
export const OverallConditionSchema = z.enum(['excellent', 'good', 'fair', 'poor']);
export const WaterCrossingDifficultySchema = z.enum(['easy', 'moderate', 'difficult']);

export const TrailConditionReportSchema = z.object({
  id: z.string(),
  trailId: z.string().nullable().optional(),
  trailName: z.string(),
  trailRegion: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  surface: TrailSurfaceSchema,
  overallCondition: OverallConditionSchema,
  hazards: z.array(z.string()),
  waterCrossings: z.number(),
  waterCrossingDifficulty: WaterCrossingDifficultySchema.nullable().optional(),
  notes: z.string().nullable().optional(),
  photos: z.array(z.string()),
  userId: z.string().optional(),
  tripId: z.string().nullable().optional(),
  deleted: z.boolean(),
  localCreatedAt: datetimeString.optional(),
  localUpdatedAt: datetimeString.optional(),
  createdAt: datetimeString.optional(),
  updatedAt: datetimeString.optional(),
});

export type TrailConditionReport = z.infer<typeof TrailConditionReportSchema>;

const TrailConditionReportFieldsSchema = z.object({
  id: z.string().describe('Client-generated report ID'),
  trailId: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .describe('Picked trail (trail-conditions/trails). Omit for a pinned report.'),
  trailName: z.string().min(1).describe("The trail's name, or the pin's label"),
  trailRegion: z.string().optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  surface: TrailSurfaceSchema,
  overallCondition: OverallConditionSchema,
  hazards: z.array(z.string()).optional(),
  waterCrossings: z.number().int().min(0).max(20).optional(),
  waterCrossingDifficulty: WaterCrossingDifficultySchema.optional().nullable(),
  notes: z.string().optional().nullable(),
  photos: z.array(z.string().min(1)).max(5).optional(),
  tripId: z.string().optional().nullable(),
  localCreatedAt: z.string().datetime(),
  localUpdatedAt: z.string().datetime(),
});

const hasBothOrNeither = (r: { latitude?: number | null; longitude?: number | null }) =>
  (r.latitude == null) === (r.longitude == null);

// A report is about a picked trail or a dropped pin; never a typed name alone.
export const CreateTrailConditionReportRequestSchema = TrailConditionReportFieldsSchema.refine(
  hasBothOrNeither,
  { message: 'latitude and longitude go together', path: ['latitude'] },
).refine((r) => r.trailId != null || r.latitude != null, {
  message: 'Pick a trail or drop a pin',
  path: ['trailId'],
});

// The trail and the place are what the report is about; they don't change.
export const UpdateTrailConditionReportRequestSchema = TrailConditionReportFieldsSchema.omit({
  id: true,
  localCreatedAt: true,
  trailId: true,
  latitude: true,
  longitude: true,
}).partial();

// Flagging someone else's report for review. Hidden from the flagger at once.
export const TrailConditionFlagReasonSchema = z.enum(['inaccurate', 'offensive', 'spam']);
export const FlagTrailConditionReportRequestSchema = z.object({
  reason: TrailConditionFlagReasonSchema,
});

// Admin moderation queue: one row per flagged report.
const AdminPersonSchema = z.object({
  id: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  avatarUrl: z.string().nullable().optional(),
});

export const AdminTrailFlagSchema = z.object({
  reportId: z.string(),
  trailId: z.string().nullable(),
  trailName: z.string(),
  overallCondition: z.string(),
  hazards: z.array(z.string()),
  notes: z.string().nullable(),
  photos: z.array(z.string()),
  author: AdminPersonSchema,
  writtenAt: z.string().datetime(),
  flagCount: z.number().int(),
  reasons: z.array(TrailConditionFlagReasonSchema),
  reporters: z.array(AdminPersonSchema),
  firstFlaggedAt: z.string().datetime(),
  lastFlaggedAt: z.string().datetime(),
});

export const AdminTrailFlagsResponseSchema = z.object({
  items: z.array(AdminTrailFlagSchema),
});

export type AdminTrailFlag = z.infer<typeof AdminTrailFlagSchema>;

// ── Trails (PackRat-owned trail table on the trail database) ─────────

export const TrailRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  length_m: z.number(),
  center_lat: z.number(),
  center_lon: z.number(),
  bbox: z.string(),
  distance_m: z.number().nullable(),
});

export const TrailDetailRowSchema = TrailRowSchema.extend({
  geometry: z.string(),
});

export type TrailRow = z.infer<typeof TrailRowSchema>;
export type TrailDetailRow = z.infer<typeof TrailDetailRowSchema>;

/** Which trail-condition pushes the user receives. */
export const TrailConditionNotificationSettingsSchema = z.object({ trailConditions: z.boolean() });
