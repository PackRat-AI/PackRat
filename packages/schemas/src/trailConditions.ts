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
  trailName: z.string(),
  trailRegion: z.string().nullable().optional(),
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

export const CreateTrailConditionReportRequestSchema = z.object({
  // id optional — server mints if absent (lean callers). Offline-first
  // stores keep supplying client-side IDs for sync. min(1) rejects ''.
  id: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Client-generated report ID; server mints when absent'),
  trailName: z.string().min(1),
  trailRegion: z.string().optional().nullable(),
  surface: TrailSurfaceSchema,
  overallCondition: OverallConditionSchema,
  hazards: z.array(z.string()).optional(),
  waterCrossings: z.number().int().min(0).max(20).optional(),
  waterCrossingDifficulty: WaterCrossingDifficultySchema.optional().nullable(),
  notes: z.string().optional().nullable(),
  photos: z.array(z.string()).optional(),
  tripId: z.string().optional().nullable(),
  localCreatedAt: z.string().datetime(),
  localUpdatedAt: z.string().datetime(),
});

export const UpdateTrailConditionReportRequestSchema = CreateTrailConditionReportRequestSchema.omit(
  {
    id: true,
    localCreatedAt: true,
  },
).partial();
