import { z } from '@hono/zod-openapi';

export const GearMentionSchema = z
  .object({
    item: z.string().openapi({
      example: 'lightweight tent',
      description: 'Name or description of the gear item mentioned',
    }),
    category: z.string().optional().openapi({
      example: 'shelter',
      description: 'Category of the gear item',
    }),
    context: z.string().optional().openapi({
      example: 'for 2-person backpacking trips',
      description: 'Additional context about how the item is used',
    }),
  })
  .openapi('GearMention');

export const ExtractedGearsSchema = z
  .object({
    gears: z.array(GearMentionSchema).openapi({
      description: 'List of extracted gear items from the content',
    }),
  })
  .openapi('ExtractedGears');

export const ProductLinkSchema = z
  .object({
    id: z.number().int().positive().openapi({ example: 12345 }),
    name: z.string().openapi({ example: 'MSR Hubba Hubba NX 2-Person Tent' }),
    productUrl: z.string().openapi({ example: 'https://example.com/product/tent' }),
    price: z.number().nullable().openapi({ example: 449.95 }),
    brand: z.string().nullable().openapi({ example: 'MSR' }),
    similarity: z.number().min(0).max(1).openapi({
      example: 0.85,
      description: 'Similarity score between the gear mention and product',
    }),
    weight: z.number().optional().openapi({ example: 1720, description: 'Weight in grams' }),
    weightUnit: z.string().optional().openapi({ example: 'g' }),
    categories: z
      .array(z.string())
      .nullable()
      .openapi({
        example: ['camping', 'backpacking', 'shelter'],
      }),
  })
  .openapi('ProductLink');

export const GearWithLinksSchema = z
  .object({
    gear: GearMentionSchema,
    products: z.array(ProductLinkSchema).openapi({
      description: 'Relevant products from catalog matching the gear mention',
    }),
  })
  .openapi('GearWithLinks');

export const AugmentGuideRequestSchema = z
  .object({
    content: z.string().min(1).openapi({
      example: 'When planning a backpacking trip, a lightweight tent is essential...',
      description: 'The guide content to analyze and augment with product links',
    }),
    maxProductsPerGear: z.number().int().min(1).max(10).optional().default(3).openapi({
      example: 3,
      description: 'Maximum number of product links to include per gear item',
    }),
    similarityThreshold: z.number().min(0).max(1).optional().default(0.3).openapi({
      example: 0.3,
      description: 'Minimum similarity score required to include a product link',
    }),
  })
  .openapi('AugmentGuideRequest');

export const AugmentGuideResponseSchema = z
  .object({
    extractedGears: z.array(GearWithLinksSchema).openapi({
      description: 'Gear items found in content with their matching products',
    }),
    augmentedContent: z.string().openapi({
      description: 'Original content with product links inserted',
    }),
    totalProductsAdded: z.number().int().openapi({
      example: 12,
      description: 'Total number of product links added to the content',
    }),
  })
  .openapi('AugmentGuideResponse');

export const ErrorResponseSchema = z
  .object({
    error: z.string().openapi({
      description: 'Error message',
    }),
    code: z.string().optional().openapi({
      description: 'Error code for programmatic handling',
    }),
  })
  .openapi('ErrorResponse');

export const ExtractGearsRequestSchema = z
  .object({
    content: z.string().min(1).openapi({
      example: 'When planning a backpacking trip, a lightweight tent is essential...',
      description: 'The content to analyze for gear mentions',
    }),
  })
  .openapi('ExtractGearsRequest');
