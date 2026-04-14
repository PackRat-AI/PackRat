import { z } from 'zod';
import { CatalogItemSchema } from './catalog';

export const DetectedItemSchema = z.object({
  name: z.string(),
  description: z.string(),
  quantity: z.number().int().positive(),
  category: z.string(),
  consumable: z.boolean().default(false).describe('Whether the item is consumable'),
  worn: z.boolean().default(false).describe('Whether the item is worn'),
  notes: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1),
});

export const DetectedItemWithMatchesSchema = z.object({
  detected: DetectedItemSchema,
  catalogMatches: z.array(CatalogItemSchema),
});

export const AnalyzeImageRequestSchema = z.object({
  image: z.string(),
  matchLimit: z.number().int().min(1).max(10).optional().default(3),
});

export const AnalyzeImageResponseSchema = z.array(DetectedItemWithMatchesSchema);
