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

export const VectorSearchQuerySchema = z
  .object({
    q: z.string().min(1).openapi({
      example: 'lightweight tent for backpacking',
      description: 'Search query string',
    }),
  })
  .openapi('VectorSearchQuery');

export const SimilarItemSchema = z
  .object({
    id: z.string().openapi({
      example: 'ci_123456',
      description: 'Catalog item ID',
    }),
    name: z.string().openapi({
      example: 'MSR Hubba Hubba NX 2-Person Tent',
      description: 'Item name',
    }),
    similarity: z.number().min(0).max(1).openapi({
      example: 0.85,
      description: 'Similarity score between 0 and 1',
    }),
  })
  .openapi('SimilarItem');

export const VectorSearchResponseSchema = z
  .array(SimilarItemSchema)
  .openapi('VectorSearchResponse');
