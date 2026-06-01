/**
 * Request schemas for the dev-only content generation routes
 * (`app/api/dev/generate-post`, `app/api/dev/generate-batch`).
 *
 * Kept in sync with the input types in `scripts/generate-content.ts`.
 */
import { z } from 'zod';

export const ContentCategorySchema = z.enum([
  'gear-essentials',
  'pack-strategy',
  'weight-management',
  'trip-planning',
  'seasonal-guides',
  'activity-specific',
  'destination-guides',
  'maintenance',
  'emergency-prep',
  'family-adventures',
  'budget-options',
  'sustainability',
  'tech-outdoors',
  'food-nutrition',
  'beginner-resources',
]);

export const DifficultyLevelSchema = z.enum(['Beginner', 'Intermediate', 'Advanced', 'All Levels']);

export const GeneratePostRequestSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  categories: z.array(ContentCategorySchema).min(1, 'At least one category is required'),
  difficulty: DifficultyLevelSchema.optional(),
  author: z.string().optional(),
  generateFullContent: z.boolean().optional(),
});

export const GenerateBatchRequestSchema = z.object({
  count: z.coerce.number().int().min(1).max(20).default(5),
  categories: z.array(ContentCategorySchema).optional(),
});
