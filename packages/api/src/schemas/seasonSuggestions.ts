import { z } from 'zod';

export const SeasonSuggestionsRequestSchema = z.object({
  location: z.string(),
  date: z.string(),
});

export const PackSuggestionSchema = z.object({
  name: z.string(),
  description: z.string(),
  category: z.string().nullable(),
  items: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().nullable(),
        weight: z.number().int(),
        weightUnit: z.string(),
        quantity: z.number().int().min(1),
        category: z.string().nullable(),
        consumable: z.boolean(),
        worn: z.boolean(),
        image: z
          .string()
          .nullable()
          .optional()
          ,
        notes: z.string().nullable(),
        catalogItemId: z.number().int().nullable(),
      }),
    )
    ,
});

export const SeasonSuggestionsResponseSchema = z.object({
  suggestions: z.array(PackSuggestionSchema),
  totalInventoryItems: z.number(),
  location: z.string(),
  season: z.string(),
});

export const ErrorResponseSchema = z.object({
  error: z.string(),
});
