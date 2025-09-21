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
  items: z
    .array(
      z.object({
        id: z.number().openapi({
          example: 123,
          description: 'ID of the item from user inventory',
        }),
        name: z.string().openapi({
          example: 'Ultralight Rain Jacket',
          description: 'Name of the item',
        }),
        quantity: z.number().default(1).openapi({
          example: 1,
          description: 'Recommended quantity of this item',
        }),
        reason: z.string().optional().openapi({
          example: 'Essential for unexpected summer showers',
          description: 'Explanation for including this item',
        }),
      }),
    )
    .openapi({
      description: 'List of items to include in the pack',
    }),
  season: z.string().openapi({
    example: 'Summer',
    description: 'Season this pack is designed for',
  }),
  activityType: z.string().openapi({
    example: 'Day Hiking',
    description: 'Type of outdoor activity this pack supports',
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
