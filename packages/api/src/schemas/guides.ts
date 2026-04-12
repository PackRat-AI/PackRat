import { z } from 'zod';

export const ErrorResponseSchema = z
  .object({
    error: z.string(),
    code: z.string().optional(),
  })

export const GuideSchema = z
  .object({
    id: z.string(),
    key: z.string(),
    title: z.string(),
    category: z.string(),
    categories: z
      .array(z.string())
      .optional()
      ,
    description: z.string(),
    author: z.string().optional(),
    readingTime: z.number().optional(),
    difficulty: z.string().optional(),
    content: z.string().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })

export const GuideDetailSchema = GuideSchema.extend({
  content: z.string(),
});

export const GuidesQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().optional().default(20),
    category: z.string().optional(),
    sort: z
      .object({
        field: z.enum(['title', 'category', 'createdAt', 'updatedAt']),
        order: z.enum(['asc', 'desc']),
      })
      .optional()
      ,
  })

export const GuidesResponseSchema = z
  .object({
    items: z.array(GuideSchema),
    totalCount: z.number(),
    page: z.number(),
    limit: z.number(),
    totalPages: z.number(),
  })

export const GuideSearchQuerySchema = z
  .object({
    q: z.string().min(1),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().optional().default(20),
    category: z.string().optional(),
  })

export const GuideSearchResponseSchema = z
  .object({
    items: z.array(GuideSchema),
    totalCount: z.number(),
    page: z.number(),
    limit: z.number(),
    totalPages: z.number(),
    query: z.string(),
  })
