import { z } from '@hono/zod-openapi';

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

export const CatalogItemSchema = z
  .object({
    id: z.number().int().positive().openapi({ example: 12345 }),
    name: z.string().openapi({ example: 'MSR Hubba Hubba NX 2-Person Tent' }),
    productUrl: z.string().openapi({ example: 'https://example.com/product/tent' }),
    sku: z.string().openapi({ example: 'MSR-123' }),
    weight: z.number().openapi({ example: 1720, description: 'Weight in grams' }),
    weightUnit: z.string().openapi({ example: 'g' }),
    description: z.string().nullable().openapi({
      example: 'Lightweight 2-person backpacking tent with excellent ventilation',
    }),
    categories: z
      .array(z.string())
      .nullable()
      .openapi({ example: ['camping', 'backpacking', 'shelter'] }),
    images: z
      .array(z.string())
      .nullable()
      .openapi({ example: ['https://example.com/tent.jpg'] }),
    brand: z.string().nullable().openapi({ example: 'MSR' }),
    model: z.string().nullable().openapi({ example: 'Hubba Hubba NX' }),
    ratingValue: z.number().nullable().openapi({ example: 4.5 }),
    color: z.string().nullable().openapi({ example: 'Green' }),
    size: z.string().nullable().openapi({ example: '2-Person' }),
    price: z.number().nullable().openapi({ example: 449.95 }),
    availability: z
      .enum(['in_stock', 'out_of_stock', 'preorder'])
      .nullable()
      .openapi({ example: 'in_stock' }),
    seller: z.string().nullable().openapi({ example: 'REI' }),
    productSku: z.string().nullable().openapi({ example: 'REI-789' }),
    material: z.string().nullable().openapi({ example: 'Nylon' }),
    currency: z.string().nullable().openapi({ example: 'USD' }),
    condition: z.string().nullable().openapi({ example: 'New' }),
    reviewCount: z.number().int().nullable().openapi({ example: 127 }),
    variants: z
      .array(
        z.object({
          attribute: z.string(),
          values: z.array(z.string()),
        }),
      )
      .nullable()
      .optional(),
    techs: z.record(z.string(), z.string()).nullable().optional(),
    links: z
      .array(
        z.object({
          title: z.string(),
          url: z.string(),
        }),
      )
      .nullable()
      .optional(),
    reviews: z
      .array(
        z.object({
          user_name: z.string(),
          user_avatar: z.string().nullable().optional(),
          context: z.record(z.string(), z.string()).nullable().optional(),
          recommends: z.boolean().nullable().optional(),
          rating: z.number(),
          title: z.string(),
          text: z.string(),
          date: z.string(),
          images: z.array(z.string()).nullable().optional(),
          upvotes: z.number().nullable().optional(),
          downvotes: z.number().nullable().optional(),
          verified: z.boolean().nullable().optional(),
        }),
      )
      .nullable()
      .optional(),
    qas: z
      .array(
        z.object({
          question: z.string(),
          user: z.string().nullable().optional(),
          date: z.string(),
          answers: z.array(
            z.object({
              a: z.string(),
              date: z.string(),
              user: z.string().nullable().optional(),
              upvotes: z.number().nullable().optional(),
            }),
          ),
        }),
      )
      .nullable()
      .optional(),
    faqs: z
      .array(
        z.object({
          question: z.string(),
          answer: z.string(),
        }),
      )
      .nullable()
      .optional(),
    createdAt: z.string().datetime().openapi({ example: '2024-01-01T00:00:00Z' }),
    updatedAt: z.string().datetime().openapi({ example: '2024-01-01T00:00:00Z' }),
  })
  .openapi('CatalogItem');

export const CatalogItemsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().optional().default(1).openapi({
      example: 1,
      description: 'Page number for pagination',
    }),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20).openapi({
      example: 20,
      description: 'Number of items per page',
    }),
    q: z.string().optional().openapi({
      example: 'tent',
      description: 'Search query string',
    }),
    category: z.string().optional().openapi({
      example: 'Tents',
      description: 'Filter by category',
    }),
    sort: z
      .object({
        field: z.enum(['name', 'brand', 'price', 'ratingValue', 'createdAt', 'updatedAt']).openapi({
          example: 'price',
          description: 'Field to sort by',
        }),
        order: z.enum(['asc', 'desc']).openapi({
          example: 'asc',
          description: 'Sort order',
        }),
      })
      .optional(),
  })
  .openapi('CatalogItemsQuery');

export const CatalogItemsResponseSchema = z
  .object({
    items: z.array(CatalogItemSchema),
    totalCount: z.number().openapi({ example: 150 }),
    page: z.number().openapi({ example: 1 }),
    limit: z.number().openapi({ example: 20 }),
    totalPages: z.number().openapi({ example: 8 }),
  })
  .openapi('CatalogItemsResponse');

export const CreateCatalogItemRequestSchema = z
  .object({
    name: z.string().min(1).max(255).openapi({ example: 'MSR Hubba Hubba NX 2-Person Tent' }),
    productUrl: z.string().url().openapi({ example: 'https://example.com/product/tent' }),
    sku: z.string().openapi({ example: 'MSR-123' }),
    weight: z.number().openapi({ example: 1720 }),
    weightUnit: z.string().openapi({ example: 'g' }),
    description: z.string().optional(),
    categories: z.array(z.string()).optional(),
    images: z.array(z.string()).optional(),
    brand: z.string().optional(),
    model: z.string().optional(),
    ratingValue: z.number().min(0).max(5).optional(),
    color: z.string().optional(),
    size: z.string().optional(),
    price: z.number().optional(),
    availability: z.enum(['in_stock', 'out_of_stock', 'preorder']).optional(),
    seller: z.string().optional(),
    productSku: z.string().optional(),
    material: z.string().optional(),
    currency: z.string().optional(),
    condition: z.string().optional(),
    reviewCount: z.number().min(0).optional(),
    variants: z
      .array(
        z.object({
          attribute: z.string(),
          values: z.array(z.string()),
        }),
      )
      .optional(),
    techs: z.record(z.string(), z.string()).optional(),
    links: z
      .array(
        z.object({
          title: z.string(),
          url: z.string(),
        }),
      )
      .optional(),
    reviews: z
      .array(
        z.object({
          user_name: z.string(),
          user_avatar: z.string().optional(),
          context: z.record(z.string(), z.string()).optional(),
          recommends: z.boolean().optional(),
          rating: z.number(),
          title: z.string(),
          text: z.string(),
          date: z.string(),
          images: z.array(z.string()).optional(),
          upvotes: z.number().optional(),
          downvotes: z.number().optional(),
          verified: z.boolean().optional(),
        }),
      )
      .optional(),
    qas: z
      .array(
        z.object({
          question: z.string(),
          user: z.string().optional(),
          date: z.string(),
          answers: z.array(
            z.object({
              a: z.string(),
              date: z.string(),
              user: z.string().optional(),
              upvotes: z.number().optional(),
            }),
          ),
        }),
      )
      .optional(),
    faqs: z
      .array(
        z.object({
          question: z.string(),
          answer: z.string(),
        }),
      )
      .optional(),
  })
  .openapi('CreateCatalogItemRequest');

export const UpdateCatalogItemRequestSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    productUrl: z.string().url().optional(),
    sku: z.string().optional(),
    weight: z.number().optional(),
    weightUnit: z.string().optional(),
    description: z.string().optional(),
    categories: z.array(z.string()).optional(),
    images: z.array(z.string()).optional(),
    brand: z.string().optional(),
    model: z.string().optional(),
    ratingValue: z.number().min(0).max(5).optional(),
    color: z.string().optional(),
    size: z.string().optional(),
    price: z.number().optional(),
    availability: z.enum(['in_stock', 'out_of_stock', 'preorder']).optional(),
    seller: z.string().optional(),
    productSku: z.string().optional(),
    material: z.string().optional(),
    currency: z.string().optional(),
    condition: z.string().optional(),
    reviewCount: z.number().min(0).optional(),
    variants: z
      .array(
        z.object({
          attribute: z.string(),
          values: z.array(z.string()),
        }),
      )
      .optional(),
    techs: z.record(z.string(), z.string()).optional(),
    links: z
      .array(
        z.object({
          title: z.string(),
          url: z.string(),
        }),
      )
      .optional(),
    reviews: z
      .array(
        z.object({
          user_name: z.string(),
          user_avatar: z.string().optional(),
          context: z.record(z.string(), z.string()).optional(),
          recommends: z.boolean().optional(),
          rating: z.number(),
          title: z.string(),
          text: z.string(),
          date: z.string(),
          images: z.array(z.string()).optional(),
          upvotes: z.number().optional(),
          downvotes: z.number().optional(),
          verified: z.boolean().optional(),
        }),
      )
      .optional(),
    qas: z
      .array(
        z.object({
          question: z.string(),
          user: z.string().optional(),
          date: z.string(),
          answers: z.array(
            z.object({
              a: z.string(),
              date: z.string(),
              user: z.string().optional(),
              upvotes: z.number().optional(),
            }),
          ),
        }),
      )
      .optional(),
    faqs: z
      .array(
        z.object({
          question: z.string(),
          answer: z.string(),
        }),
      )
      .optional(),
  })
  .openapi('UpdateCatalogItemRequest');

export const CatalogCategoriesResponseSchema = z
  .array(z.string().openapi({ example: 'Tents' }))
  .openapi('CatalogCategoriesResponse');

export const VectorSearchQuerySchema = z
  .object({
    q: z.string().min(1).openapi({
      example: 'lightweight tent for backpacking',
      description: 'Search query string',
    }),
    limit: z.coerce.number().int().min(1).max(50).optional().default(10).openapi({
      example: 10,
      description: 'Maximum number of results to return',
    }),
    offset: z.coerce.number().int().min(0).optional().default(0).openapi({
      example: 0,
      description: 'Number of results to skip for pagination',
    }),
  })
  .openapi('VectorSearchQuery');

export const SimilarItemSchema = CatalogItemSchema.extend({
  similarity: z.number().min(0).max(1).openapi({
    example: 0.85,
    description: 'Similarity score between 0 and 1',
  }),
}).openapi('SimilarItem');

export const VectorSearchResponseSchema = z
  .object({
    items: z.array(SimilarItemSchema),
    total: z.number().openapi({ example: 150 }),
    limit: z.number().openapi({ example: 10 }),
    offset: z.number().openapi({ example: 0 }),
    nextOffset: z.number().openapi({ example: 10 }),
  })
  .openapi('VectorSearchResponse');
