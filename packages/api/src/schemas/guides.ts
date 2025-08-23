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

export const GuideSchema = z
  .object({
    id: z.string().openapi({
      example: 'ultralight-backpacking',
      description: 'Unique identifier for the guide',
    }),
    key: z.string().openapi({
      example: 'ultralight-backpacking.mdx',
      description: 'Storage key/filename for the guide',
    }),
    title: z.string().openapi({
      example: 'Ultimate Guide to Ultralight Backpacking',
      description: 'Guide title',
    }),
    category: z.string().openapi({
      example: 'backpacking',
      description: 'Guide category',
    }),
    categories: z
      .array(z.string())
      .optional()
      .openapi({
        example: ['backpacking', 'gear', 'ultralight'],
        description: 'Array of categories/tags for the guide',
      }),
    description: z.string().openapi({
      example: 'Learn the principles of ultralight backpacking and how to reduce your pack weight',
      description: 'Brief description of the guide',
    }),
    author: z.string().optional().openapi({
      example: 'John Doe',
      description: 'Guide author name',
    }),
    readingTime: z.number().optional().openapi({
      example: 15,
      description: 'Estimated reading time in minutes',
    }),
    difficulty: z.string().optional().openapi({
      example: 'intermediate',
      description: 'Difficulty level of the guide',
    }),
    content: z.string().optional().openapi({
      description: 'Full content of the guide (only included in single guide responses)',
    }),
    createdAt: z.string().datetime().openapi({
      example: '2024-01-01T00:00:00Z',
      description: 'When the guide was created',
    }),
    updatedAt: z.string().datetime().openapi({
      example: '2024-01-01T00:00:00Z',
      description: 'When the guide was last updated',
    }),
  })
  .openapi('Guide');

export const GuideDetailSchema = GuideSchema.extend({
  content: z.string().openapi({
    description: 'Full markdown/MDX content of the guide',
  }),
}).openapi('GuideDetail');

export const GuidesQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().optional().default(1).openapi({
      example: 1,
      description: 'Page number for pagination',
    }),
    limit: z.coerce.number().int().positive().optional().default(20).openapi({
      example: 20,
      description: 'Number of guides per page',
    }),
    category: z.string().optional().openapi({
      example: 'backpacking',
      description: 'Filter guides by category',
    }),
    sort: z
      .object({
        field: z.enum(['title', 'category', 'createdAt', 'updatedAt']).openapi({
          example: 'title',
          description: 'Field to sort by',
        }),
        order: z.enum(['asc', 'desc']).openapi({
          example: 'asc',
          description: 'Sort order',
        }),
      })
      .optional()
      .openapi({
        description: 'Sort parameters',
      }),
  })
  .openapi('GuidesQuery');

export const GuidesResponseSchema = z
  .object({
    items: z.array(GuideSchema),
    totalCount: z.number().openapi({
      example: 45,
      description: 'Total number of guides',
    }),
    page: z.number().openapi({
      example: 1,
      description: 'Current page number',
    }),
    limit: z.number().openapi({
      example: 20,
      description: 'Number of items per page',
    }),
    totalPages: z.number().openapi({
      example: 3,
      description: 'Total number of pages',
    }),
  })
  .openapi('GuidesResponse');

export const GuideSearchQuerySchema = z
  .object({
    q: z.string().min(1).openapi({
      example: 'ultralight',
      description: 'Search query string',
    }),
    page: z.coerce.number().int().positive().optional().default(1).openapi({
      example: 1,
      description: 'Page number for pagination',
    }),
    limit: z.coerce.number().int().positive().optional().default(20).openapi({
      example: 20,
      description: 'Number of results per page',
    }),
    category: z.string().optional().openapi({
      example: 'backpacking',
      description: 'Filter results by category',
    }),
  })
  .openapi('GuideSearchQuery');

export const GuideSearchResponseSchema = z
  .object({
    items: z.array(GuideSchema),
    totalCount: z.number().openapi({
      example: 8,
      description: 'Total number of search results',
    }),
    page: z.number().openapi({
      example: 1,
      description: 'Current page number',
    }),
    limit: z.number().openapi({
      example: 20,
      description: 'Number of items per page',
    }),
    totalPages: z.number().openapi({
      example: 1,
      description: 'Total number of pages',
    }),
    query: z.string().openapi({
      example: 'ultralight',
      description: 'The search query that was performed',
    }),
  })
  .openapi('GuideSearchResponse');
