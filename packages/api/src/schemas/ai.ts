import { z } from 'zod';

export const RagSearchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(5),
});

export const WebSearchQuerySchema = z.object({
  q: z.string().min(1),
});

export const RagSearchResponseSchema = z.object({
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
});

export const WebSearchResponseSchema = z.object({
  answer: z.string(),
  sources: z.array(z.unknown()),
});

export const ErrorResponseSchema = z.object({
  error: z.string(),
});
