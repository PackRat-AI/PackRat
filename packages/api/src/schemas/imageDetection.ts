import { z } from '@hono/zod-openapi';

export const DetectedItemSchema = z
  .object({
    name: z.string().openapi({ example: 'Down Sleeping Bag' }),
    description: z
      .string()
      .openapi({ example: 'Lightweight down sleeping bag, appears to be rated for cold weather' }),
    quantity: z.number().int().positive().openapi({ example: 1 }),
    category: z.string().openapi({ example: 'Sleep System' }),
    confidence: z.number().min(0).max(1).openapi({
      example: 0.85,
      description: 'Confidence level in the identification (0-1)',
    }),
  })
  .openapi('DetectedItem');

export const CatalogMatchSchema = z
  .object({
    id: z.number().int().openapi({ example: 12345 }),
    name: z.string().openapi({ example: 'Western Mountaineering UltraLite Sleeping Bag' }),
    description: z.string().nullable().openapi({
      example: 'Lightweight down sleeping bag rated to 20°F',
    }),
    weight: z.number().nullable().openapi({ example: 850 }),
    weightUnit: z.string().nullable().openapi({ example: 'g' }),
    image: z.string().nullable().openapi({
      example: 'https://example.com/sleeping-bag.jpg',
    }),
    similarity: z.number().min(0).max(1).openapi({
      example: 0.92,
      description: 'Similarity score with the detected item (0-1)',
    }),
  })
  .openapi('CatalogMatch');

export const DetectedItemWithMatchesSchema = z
  .object({
    detected: DetectedItemSchema,
    catalogMatches: z.array(CatalogMatchSchema),
  })
  .openapi('DetectedItemWithMatches');

export const AnalyzeImageRequestSchema = z
  .object({
    image: z.string().openapi({
      example: '35-Ly81kdLKn1Z1pHpmiQu8A.jpg',
      description: 'Object key of the image to analyze.',
    }),
    matchLimit: z.number().int().min(1).max(10).optional().default(3).openapi({
      example: 3,
      description: 'Maximum number of catalog matches to return per detected item',
    }),
  })
  .openapi('AnalyzeImageRequest');

export const AnalyzeImageResponseSchema = z
  .array(DetectedItemWithMatchesSchema)
  .openapi('AnalyzeImageResponse');

export const CreatePackFromImageRequestSchema = z
  .object({
    imageUrl: z.string().url().openapi({
      example: 'https://packrat-bucket.r2.dev/123-gear-layout.jpg',
    }),
    packName: z.string().min(1).max(255).openapi({
      example: 'Gear from Photo - Weekend Trip',
    }),
    packDescription: z.string().optional().openapi({
      example: 'Pack created from analyzed gear photo',
    }),
    isPublic: z.boolean().optional().default(false).openapi({ example: false }),
    minConfidence: z.number().min(0).max(1).optional().default(0.5).openapi({
      example: 0.7,
      description: 'Minimum confidence threshold for including detected items',
    }),
  })
  .openapi('CreatePackFromImageRequest');

export const CreatePackFromImageResponseSchema = z
  .object({
    pack: z.object({
      id: z.string().openapi({ example: 'p_abc123' }),
      name: z.string().openapi({ example: 'Gear from Photo - Weekend Trip' }),
      description: z.string().nullable(),
      itemsCount: z.number().int().openapi({ example: 8 }),
    }),
    detectedItems: z.array(DetectedItemWithMatchesSchema),
    summary: z.string(),
  })
  .openapi('CreatePackFromImageResponse');
