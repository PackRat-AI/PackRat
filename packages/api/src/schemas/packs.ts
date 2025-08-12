import { z } from '@hono/zod-openapi';

export const PackItemSchema = z
  .object({
    id: z.string().openapi({ example: 'pi_123456' }),
    packId: z.string().openapi({ example: 'p_123456' }),
    name: z.string().openapi({ example: 'Sleeping Bag' }),
    category: z.string().nullable().openapi({ example: 'Sleep System' }),
    quantity: z.number().int().min(1).openapi({ example: 1 }),
    weight: z.number().nullable().openapi({ example: 850, description: 'Weight in grams' }),
    unit: z.string().nullable().openapi({ example: 'g' }),
    wornWeight: z
      .number()
      .nullable()
      .openapi({ example: 0, description: 'Weight when worn in grams' }),
    image: z.string().nullable().openapi({ example: 'https://example.com/image.jpg' }),
    description: z.string().nullable().openapi({ example: 'Down sleeping bag rated to -5°C' }),
    tags: z
      .array(z.string())
      .nullable()
      .openapi({ example: ['sleeping', 'camping'] }),
    deleted: z.boolean().openapi({ example: false }),
    createdAt: z.string().datetime().openapi({ example: '2024-01-01T00:00:00Z' }),
    updatedAt: z.string().datetime().openapi({ example: '2024-01-01T00:00:00Z' }),
  })
  .openapi('PackItem');

export const PackSchema = z
  .object({
    id: z.string().openapi({ example: 'p_123456' }),
    userId: z.number().openapi({ example: 1 }),
    name: z.string().openapi({ example: 'Weekend Backpacking Trip' }),
    description: z
      .string()
      .nullable()
      .openapi({ example: 'Pack for 2-day backpacking trip in the mountains' }),
    category: z.string().nullable().openapi({ example: 'Backpacking' }),
    isPublic: z.boolean().openapi({ example: false }),
    image: z.string().nullable().openapi({ example: 'https://example.com/pack-image.jpg' }),
    tags: z
      .array(z.string())
      .nullable()
      .openapi({ example: ['backpacking', 'summer', 'mountains'] }),
    deleted: z.boolean().openapi({ example: false }),
    createdAt: z.string().datetime().openapi({ example: '2024-01-01T00:00:00Z' }),
    updatedAt: z.string().datetime().openapi({ example: '2024-01-01T00:00:00Z' }),
    items: z.array(PackItemSchema).optional(),
  })
  .openapi('Pack');

export const PackWithWeightsSchema = PackSchema.extend({
  totalWeight: z.number().openapi({ example: 5500, description: 'Total pack weight in grams' }),
  baseWeight: z
    .number()
    .openapi({ example: 4000, description: 'Base weight (excluding consumables) in grams' }),
  wornWeight: z.number().openapi({ example: 1000, description: 'Weight of worn items in grams' }),
  packWeight: z
    .number()
    .openapi({ example: 4500, description: 'Pack weight (excluding worn items) in grams' }),
  foodWeight: z.number().openapi({ example: 500, description: 'Food weight in grams' }),
  waterWeight: z.number().openapi({ example: 1000, description: 'Water weight in grams' }),
}).openapi('PackWithWeights');

export const CreatePackRequestSchema = z
  .object({
    name: z.string().min(1).max(255).openapi({ example: 'Weekend Backpacking Trip' }),
    description: z.string().optional().openapi({ example: 'Pack for 2-day backpacking trip' }),
    category: z.string().optional().openapi({ example: 'Backpacking' }),
    isPublic: z.boolean().optional().default(false).openapi({ example: false }),
    image: z.string().url().optional().openapi({ example: 'https://example.com/pack-image.jpg' }),
    tags: z
      .array(z.string())
      .optional()
      .openapi({ example: ['backpacking', 'summer'] }),
  })
  .openapi('CreatePackRequest');

export const UpdatePackRequestSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    isPublic: z.boolean().optional(),
    image: z.string().url().optional(),
    tags: z.array(z.string()).optional(),
    deleted: z.boolean().optional(),
  })
  .openapi('UpdatePackRequest');

export const CreatePackItemRequestSchema = z
  .object({
    name: z.string().min(1).max(255).openapi({ example: 'Sleeping Bag' }),
    category: z.string().optional().openapi({ example: 'Sleep System' }),
    quantity: z.number().int().min(1).default(1).openapi({ example: 1 }),
    weight: z.number().optional().openapi({ example: 850, description: 'Weight in grams' }),
    unit: z.string().optional().default('g').openapi({ example: 'g' }),
    wornWeight: z.number().optional().openapi({ example: 0, description: 'Weight when worn' }),
    image: z.string().url().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })
  .openapi('CreatePackItemRequest');

export const UpdatePackItemRequestSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    category: z.string().optional(),
    quantity: z.number().int().min(1).optional(),
    weight: z.number().optional(),
    unit: z.string().optional(),
    wornWeight: z.number().optional(),
    image: z.string().url().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    deleted: z.boolean().optional(),
  })
  .openapi('UpdatePackItemRequest');

export const PackListResponseSchema = z
  .object({
    packs: z.array(PackWithWeightsSchema),
    total: z.number().openapi({ example: 25 }),
    page: z.number().openapi({ example: 1 }),
    limit: z.number().openapi({ example: 10 }),
    totalPages: z.number().openapi({ example: 3 }),
  })
  .openapi('PackListResponse');

export const ItemSuggestionsRequestSchema = z
  .object({
    packDescription: z.string().openapi({
      example: 'Weekend backpacking trip in summer mountains',
      description: 'Description of the pack to get suggestions for',
    }),
  })
  .openapi('ItemSuggestionsRequest');

export const ItemSuggestionsResponseSchema = z
  .object({
    suggestions: z.array(
      z.object({
        name: z.string(),
        category: z.string(),
        weight: z.number().optional(),
        description: z.string().optional(),
        confidence: z.number().min(0).max(1).openapi({
          example: 0.85,
          description: 'Confidence score for the suggestion',
        }),
      }),
    ),
  })
  .openapi('ItemSuggestionsResponse');
