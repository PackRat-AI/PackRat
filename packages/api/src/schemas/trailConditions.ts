import { z } from '@hono/zod-openapi';

export const TrailConditionValueSchema = z.enum(['excellent', 'good', 'fair', 'poor', 'closed']);

export const TrailConditionLocationSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    name: z.string().optional(),
  })
  .nullable()
  .optional();

export const TrailConditionSchema = z.object({
  id: z.string(),
  userId: z.number(),
  trailName: z.string(),
  location: TrailConditionLocationSchema,
  condition: TrailConditionValueSchema,
  details: z.string(),
  photos: z.array(z.string()).nullable().optional(),
  trustScore: z.number(),
  verifiedCount: z.number(),
  helpfulCount: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateTrailConditionRequestSchema = z.object({
  id: z.string().openapi({
    example: 'tc_123456',
    description: 'Client-generated trail condition ID',
  }),
  trailName: z.string().min(1).openapi({ example: 'Springer Mountain to Neels Gap' }),
  location: TrailConditionLocationSchema,
  condition: TrailConditionValueSchema,
  details: z.string().min(1).openapi({ example: 'Trail is well maintained with clear blazes.' }),
  photos: z.array(z.string()).optional(),
});

export const TrailConditionListResponseSchema = z.object({
  items: z.array(TrailConditionSchema),
  total: z.number(),
});
