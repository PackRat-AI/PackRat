import { z } from '@hono/zod-openapi';

export const SeasonSuggestionsRequestSchema = z.object({
  location: z.string().openapi({
    example: 'Seattle, WA',
    description: 'User location for seasonal context',
  }),
  date: z.string().openapi({
    example: '2024-07-15',
    description: 'Date for seasonal relevance (ISO 8601 format)',
  }),
});

export const PackSuggestionSchema = z.object({
  name: z.string().openapi({
    example: 'Summer Day Hike Pack',
    description: 'Name of the suggested pack',
  }),
  description: z.string().openapi({
    example: 'Perfect for warm summer day hikes with moderate temperatures',
    description: 'Description explaining why this pack is suitable',
  }),
  category: z.string().nullable().openapi({ example: 'Backpacking' }),
  items: z
    .array(
      z.object({
        name: z.string().openapi({ example: 'Sleeping Bag' }),
        description: z.string().nullable().openapi({ example: 'Down sleeping bag rated to -5°C' }),
        weight: z.number().int().openapi({ example: 850, description: 'Weight in grams' }),
        weightUnit: z.string().openapi({ example: 'g' }),
        quantity: z.number().int().min(1).openapi({ example: 1 }),
        category: z.string().nullable().openapi({ example: 'Sleep System' }),
        consumable: z.boolean().openapi({ example: false }),
        worn: z.boolean().openapi({ example: false }),
        image: z
          .string()
          .nullable()
          .optional()
          .openapi({ example: 'https://example.com/image.jpg' }),
        notes: z.string().nullable().openapi({ example: 'Great for cold weather' }),
        catalogItemId: z.number().int().nullable().openapi({ example: 12345 }),
      }),
    )
    .openapi({
      description: 'List of items to include in the pack',
    }),
});

export const SeasonSuggestionsResponseSchema = z.object({
  suggestions: z.array(PackSuggestionSchema).openapi({
    description: 'List of pack suggestions based on season and user inventory',
  }),
  totalInventoryItems: z.number().openapi({
    example: 45,
    description: 'Total number of items in user inventory',
  }),
  location: z.string().openapi({
    example: 'Seattle, WA',
    description: 'Location used for generating suggestions',
  }),
  season: z.string().openapi({
    example: 'Summer',
    description: 'Detected season based on date and location',
  }),
});

export const ErrorResponseSchema = z.object({
  error: z.string().openapi({
    example: 'Insufficient inventory items',
    description: 'Error message',
  }),
});
