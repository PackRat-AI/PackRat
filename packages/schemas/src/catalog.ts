import { WEIGHT_UNITS } from '@packrat/constants';
import { isString } from '@packrat/guards';
import { safeJsonParse } from '@packrat/utils';
import { z } from 'zod';
import { datetimeString } from './utils';

export const CatalogItemSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  productUrl: z.string(),
  sku: z.string(),
  weight: z.number().nullable(),
  weightUnit: z.enum(WEIGHT_UNITS).nullable(),
  description: z.string().nullable(),
  categories: z.array(z.string()).nullable(),
  images: z.array(z.string()).nullable(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  ratingValue: z.number().nullable(),
  color: z.string().nullable(),
  size: z.string().nullable(),
  price: z.number().nullable(),
  availability: z.enum(['in_stock', 'out_of_stock', 'preorder']).nullable(),
  seller: z.string().nullable(),
  productSku: z.string().nullable(),
  material: z.string().nullable(),
  currency: z.string().nullable(),
  condition: z.string().nullable(),
  reviewCount: z.number().int().nullable(),
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
        user_name: z.string().nullable().optional(),
        user_avatar: z.string().nullable().optional(),
        context: z.record(z.string(), z.string()).nullable().optional(),
        recommends: z.boolean().nullable().optional(),
        rating: z.number(),
        title: z.string().nullable().optional(),
        text: z.string().nullable().optional(),
        date: z.string().nullable().optional(),
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
  usageCount: z.number().int().min(0).optional(),
  createdAt: datetimeString,
  updatedAt: datetimeString,
});

const SortSchema = z.object({
  field: z.enum([
    'name',
    'brand',
    'category',
    'price',
    'ratingValue',
    'createdAt',
    'updatedAt',
    'usage',
  ]),
  order: z.enum(['asc', 'desc']),
});

export type CatalogItem = z.infer<typeof CatalogItemSchema>;

export const CatalogItemsQuerySchema = z.object({
  // Defaults applied in the handler so Treaty types these as truly optional
  // rather than required-with-default (which forces every caller to pass them).
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  q: z.string().optional(),
  category: z.string().optional(),
  // Eden Treaty serializes nested objects as JSON strings in query params.
  // z.preprocess parses the JSON string before Zod validates the shape.
  sort: z
    .preprocess((val) => {
      if (isString(val)) {
        try {
          return safeJsonParse(val, { strict: true });
        } catch {
          return undefined;
        }
      }
      return val;
    }, SortSchema.optional())
    .optional(),
});

export const CatalogItemsResponseSchema = z.object({
  items: z.array(CatalogItemSchema),
  totalCount: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

export const CreateCatalogItemRequestSchema = z.object({
  name: z.string().min(1).max(255),
  productUrl: z.string().url(),
  sku: z.string(),
  weight: z.number().positive(),
  weightUnit: z.enum(WEIGHT_UNITS),
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
});

export const UpdateCatalogItemRequestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  productUrl: z.string().url().optional(),
  sku: z.string().optional(),
  weight: z.number().positive().optional(),
  weightUnit: z.enum(WEIGHT_UNITS).optional(),
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
});

export const CatalogCategoriesResponseSchema = z.array(z.string());

export const VectorSearchQuerySchema = z.object({
  q: z.string().min(1),
  // Defaults applied in the handler — see CatalogItemsQuerySchema for rationale.
  limit: z.coerce.number().int().min(1).max(50).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const SimilarItemSchema = CatalogItemSchema.extend({
  similarity: z.number().min(0).max(1),
});

export const VectorSearchResponseSchema = z.object({
  items: z.array(SimilarItemSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  nextOffset: z.number(),
});

export const CatalogCompareRequestSchema = z.object({
  ids: z.array(z.number().int()).min(2).max(10),
});

export const CatalogCompareRowSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  brand: z.string().nullable(),
  weight: z.number().nullable(),
  weightUnit: z.string().nullable(),
  price: z.number().nullable(),
  ratingValue: z.number().nullable(),
  productUrl: z.string().nullable(),
  categories: z.array(z.string()).nullable(),
});

export const CatalogCompareResponseSchema = z.object({
  items: z.array(CatalogCompareRowSchema),
  lightestId: z.number().int().nullable(),
  cheapestId: z.number().int().nullable(),
  highestRatedId: z.number().int().nullable(),
});

export const CatalogETLSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  chunks: z.array(z.string()).min(1, 'At least one object key is required'),
  source: z.string().min(1, 'Source name is required'),
  scraperRevision: z.string().min(1, 'Scraper revision ID is required'),
});
