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
    id: z.string().openapi({ example: 'ci_123456' }),
    name: z.string().openapi({ example: 'MSR Hubba Hubba NX 2-Person Tent' }),
    brand: z.string().nullable().openapi({ example: 'MSR' }),
    category: z.string().nullable().openapi({ example: 'Tents' }),
    description: z.string().nullable().openapi({
      example: 'Lightweight 2-person backpacking tent with excellent ventilation',
    }),
    price: z.number().nullable().openapi({ example: 449.95 }),
    currency: z.string().nullable().openapi({ example: 'USD' }),
    weight: z.number().nullable().openapi({ example: 1720, description: 'Weight in grams' }),
    unit: z.string().nullable().openapi({ example: 'g' }),
    image: z.string().nullable().openapi({ example: 'https://example.com/tent.jpg' }),
    productUrl: z.string().nullable().openapi({ example: 'https://example.com/product/tent' }),
    ratingValue: z.number().nullable().openapi({ example: 4.5 }),
    reviewCount: z.number().nullable().openapi({ example: 127 }),
    tags: z
      .array(z.string())
      .nullable()
      .openapi({ example: ['camping', 'backpacking', 'shelter'] }),
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
        field: z
          .enum(['name', 'brand', 'category', 'price', 'ratingValue', 'createdAt', 'updatedAt'])
          .openapi({
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
    brand: z.string().optional(),
    category: z.string().optional(),
    description: z.string().optional(),
    price: z.number().optional(),
    currency: z.string().optional(),
    weight: z.number().optional(),
    unit: z.string().optional(),
    image: z.string().url().optional(),
    productUrl: z.string().url().optional(),
    ratingValue: z.number().min(0).max(5).optional(),
    reviewCount: z.number().min(0).optional(),
    tags: z.array(z.string()).optional(),
  })
  .openapi('CreateCatalogItemRequest');

export const UpdateCatalogItemRequestSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    brand: z.string().optional(),
    category: z.string().optional(),
    description: z.string().optional(),
    price: z.number().optional(),
    currency: z.string().optional(),
    weight: z.number().optional(),
    unit: z.string().optional(),
    image: z.string().url().optional(),
    productUrl: z.string().url().optional(),
    ratingValue: z.number().min(0).max(5).optional(),
    reviewCount: z.number().min(0).optional(),
    tags: z.array(z.string()).optional(),
  })
  .openapi('UpdateCatalogItemRequest');

export const CatalogCategoriesResponseSchema = z
  .object({
    categories: z.array(
      z.object({
        category: z.string().openapi({ example: 'Tents' }),
        count: z.number().openapi({ example: 25 }),
      }),
    ),
  })
  .openapi('CatalogCategoriesResponse');
