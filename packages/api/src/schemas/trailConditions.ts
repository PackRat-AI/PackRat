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
