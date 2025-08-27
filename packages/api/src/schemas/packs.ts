import { z } from '@hono/zod-openapi';

export const PackItemSchema = z
  .object({
    id: z.string().openapi({ example: 'pi_123456' }),
    name: z.string().openapi({ example: 'Sleeping Bag' }),
    description: z.string().nullable().openapi({ example: 'Down sleeping bag rated to -5°C' }),
    weight: z.number().openapi({ example: 850, description: 'Weight in grams' }),
    weightUnit: z.string().openapi({ example: 'g' }),
    quantity: z.number().int().min(1).openapi({ example: 1 }),
    category: z.string().nullable().openapi({ example: 'Sleep System' }),
    consumable: z.boolean().openapi({ example: false }),
    worn: z.boolean().openapi({ example: false }),
    image: z.string().nullable().openapi({ example: 'https://example.com/image.jpg' }),
    notes: z.string().nullable().openapi({ example: 'Great for cold weather' }),
    packId: z.string().openapi({ example: 'p_123456' }),
    catalogItemId: z.number().int().nullable().openapi({ example: 12345 }),
    userId: z.number().int().openapi({ example: 1 }),
    deleted: z.boolean().openapi({ example: false }),
    templateItemId: z.string().nullable().openapi({ example: 'pti_123456' }),
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
    image: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
    deleted: z.boolean().optional(),
  })
  .openapi('UpdatePackRequest');

export const CreatePackItemRequestSchema = z
  .object({
    name: z.string().min(1).max(255).openapi({ example: 'Sleeping Bag' }),
    description: z.string().optional().openapi({ example: 'Down sleeping bag rated to -5°C' }),
    weight: z.number().openapi({ example: 850, description: 'Weight in grams' }),
    weightUnit: z.string().default('g').openapi({ example: 'g' }),
    quantity: z.number().int().min(1).default(1).openapi({ example: 1 }),
    category: z.string().optional().openapi({ example: 'Sleep System' }),
    consumable: z.boolean().optional().default(false).openapi({ example: false }),
    worn: z.boolean().optional().default(false).openapi({ example: false }),
    image: z.string().optional().openapi({ example: '35-Ly81kdLKn1Z1pHpmiQu8A.jpg' }),
    notes: z.string().optional().openapi({ example: 'Great for cold weather' }),
    catalogItemId: z.number().int().optional().openapi({ example: 12345 }),
  })
  .openapi('CreatePackItemRequest');

export const UpdatePackItemRequestSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    weight: z.number().optional(),
    weightUnit: z.string().optional(),
    quantity: z.number().int().min(1).optional(),
    category: z.string().optional(),
    consumable: z.boolean().optional(),
    worn: z.boolean().optional(),
    image: z.string().url().optional(),
    notes: z.string().optional(),
    catalogItemId: z.number().int().optional(),
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
