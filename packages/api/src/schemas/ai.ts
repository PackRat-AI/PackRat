import { z } from '@packrat/api/utils/zod-shim';

export const RagSearchQuerySchema = z
  .object({
    q: z.string().min(1).openapi({
      example: 'best sleeping bag for winter camping',
      description: 'Search query for the outdoor guides knowledge base',
    }),
    limit: z.coerce.number().int().min(1).max(100).optional().default(5).openapi({
      example: 5,
      description: 'Maximum number of results to return',
    }),
  })
  .openapi('RagSearchQuery');

export const WebSearchQuerySchema = z
  .object({
    q: z.string().min(1).openapi({
      example: 'best ultralight tents 2024',
      description: 'Search query for web search',
    }),
  })
  .openapi('WebSearchQuery');

export const RagSearchResponseSchema = z
  .object({
    object: z.string(),
    search_query: z.string(),
    has_more: z.boolean(),
    next_page: z.string().nullable(),
    data: z.array(
      z.object({
        filename: z.string(),
        url: z.string(),
        score: z.number().optional(),
        content: z.array(z.unknown()).optional(),
      }),
    ),
  })
  .openapi('RagSearchResponse');

export const WebSearchResponseSchema = z
  .object({
    answer: z.string(),
    sources: z.array(z.unknown()),
  })
  .openapi('WebSearchResponse');

export const ErrorResponseSchema = z
  .object({
    error: z.string(),
  })
  .openapi('AiErrorResponse');
