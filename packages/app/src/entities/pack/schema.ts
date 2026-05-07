import { z } from 'zod';

export const PackItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  weight: z.number(),
  weightUnit: z.string(),
  quantity: z.number().int().min(1),
  category: z.string().nullable(),
  consumable: z.boolean(),
  worn: z.boolean(),
  image: z.string().nullable(),
  notes: z.string().nullable(),
  packId: z.string(),
  catalogItemId: z.number().int().nullable(),
  userId: z.number().int(),
  deleted: z.boolean(),
  isAIGenerated: z.boolean(),
  templateItemId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const PackSchema = z.object({
  id: z.string(),
  userId: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  isPublic: z.boolean(),
  image: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  templateId: z.string().nullable().optional(),
  deleted: z.boolean(),
  isAIGenerated: z.boolean(),
  localCreatedAt: z.string().datetime().optional(),
  localUpdatedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  items: z.array(PackItemSchema).optional(),
});

// totalWeight and baseWeight are computed server-side, not locally derived
export const PackWithWeightsSchema = PackSchema.extend({
  totalWeight: z.number(),
  baseWeight: z.number(),
});

export const PackListResponseSchema = z.object({
  packs: z.array(PackWithWeightsSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});
