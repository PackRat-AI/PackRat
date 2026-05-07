import { z } from 'zod';
import { dateField } from '../../shared/lib/date';

export const CatalogItemSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  productUrl: z.string(),
  sku: z.string(),
  weight: z.number(),
  weightUnit: z.string(),
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
  createdAt: dateField.optional(),
  updatedAt: dateField.optional(),
  variants: z
    .array(z.object({ attribute: z.string(), values: z.array(z.string()) }))
    .nullable()
    .optional(),
  techs: z.record(z.string(), z.string()).nullable().optional(),
  links: z
    .array(z.object({ title: z.string(), url: z.string() }))
    .nullable()
    .optional(),
});

export const CatalogItemsResponseSchema = z.object({
  items: z.array(CatalogItemSchema),
  totalCount: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});
