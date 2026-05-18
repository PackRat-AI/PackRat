import { z } from 'zod';
import { ClientUuidSchema } from './packs';

const datetimeString = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString() : v),
  z.string().datetime(),
);

export const TrailSurfaceSchema = z.enum(['paved', 'gravel', 'dirt', 'rocky', 'snow', 'mud']);
export const OverallConditionSchema = z.enum(['excellent', 'good', 'fair', 'poor']);
export const WaterCrossingDifficultySchema = z.enum(['easy', 'moderate', 'difficult']);

export const TrailConditionReportSchema = z.object({
  id: z.string(),
  clientUuid: z.string(),
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

// `id` is legacy (Phase 1 compat shim — docs/design/client-uuid-split.md §5.4).
// `clientUuid` is the new idempotency token. Both optional; server mints.
export const CreateTrailConditionReportRequestSchema = z.object({
  id: z.string().optional().describe('Legacy client-supplied report ID'),
  clientUuid: ClientUuidSchema.optional(),
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
    clientUuid: true,
    localCreatedAt: true,
  },
).partial();
