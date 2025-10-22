import { z } from '@hono/zod-openapi';
import { CatalogItemSchema } from './catalog';

export const DetectedItemSchema = z
  .object({
    name: z.string().openapi({ example: 'Down Sleeping Bag' }),
    description: z
      .string()
      .openapi({ example: 'Lightweight down sleeping bag, appears to be rated for cold weather' }),
    quantity: z.number().int().positive().openapi({ example: 1 }),
    category: z.string().openapi({ example: 'Sleep System' }),
    consumable: z.boolean().default(false).describe('Whether the item is consumable'),
    worn: z.boolean().default(false).describe('Whether the item is worn'),
    notes: z.string().nullable().optional(),
    confidence: z.number().min(0).max(1).openapi({
      example: 0.85,
      description: 'Confidence level in the identification (0-1)',
    }),
  })
  .openapi('DetectedItem');

export const DetectedItemWithMatchesSchema = z
  .object({
    detected: DetectedItemSchema,
    catalogMatches: z.array(CatalogItemSchema),
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
