import { PACK_CATEGORIES, WEIGHT_UNITS } from '@packrat/api/types';
import { z } from 'zod';

export const PackItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  weight: z.number(),
  weightUnit: z.enum(WEIGHT_UNITS),
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
  category: z.enum(PACK_CATEGORIES).nullable(),
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

export const PackWithWeightsSchema = PackSchema.extend({
  totalWeight: z.number(),
  baseWeight: z.number(),
});

export const CreatePackRequestSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  category: z.string().optional(),
  isPublic: z.boolean().optional().default(false),
  image: z.string().nullish(),
  tags: z.array(z.string()).optional(),
});

export const UpdatePackRequestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  isPublic: z.boolean().optional(),
  image: z.string().nullish(),
  tags: z.array(z.string()).optional(),
  deleted: z.boolean().optional(),
});

export const CreatePackItemRequestSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  weight: z.number(),
  weightUnit: z.enum(WEIGHT_UNITS).default('g'),
  quantity: z.number().int().min(1).default(1),
  category: z.string().optional(),
  consumable: z.boolean().optional().default(false),
  worn: z.boolean().optional().default(false),
  image: z.string().nullish(),
  notes: z.string().optional(),
  catalogItemId: z.number().int().nullish(),
});

export const UpdatePackItemRequestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  weight: z.number().optional(),
  weightUnit: z.enum(WEIGHT_UNITS).optional(),
  quantity: z.number().int().min(1).optional(),
  category: z.string().optional(),
  consumable: z.boolean().optional(),
  worn: z.boolean().optional(),
  image: z.string().nullish(),
  notes: z.string().optional(),
  catalogItemId: z.number().int().nullish(),
  deleted: z.boolean().optional(),
});

export const PackListResponseSchema = z.object({
  packs: z.array(PackWithWeightsSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

export const ItemSuggestionsResponseSchema = z.object({
  suggestions: z.array(
    z.object({
      name: z.string(),
      category: z.string(),
      weight: z.number().optional(),
      description: z.string().optional(),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

export const GapAnalysisRequestSchema = z.object({
  destination: z.string().optional(),
  tripType: z.string().optional(),
  duration: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const GapAnalysisItemSchema = z.object({
  suggestion: z.string(),
  reason: z.string(),
  consumable: z.boolean(),
  worn: z.boolean(),
  category: z.string().optional(),
  priority: z.enum(['must-have', 'nice-to-have', 'optional']).optional(),
});

export const GapAnalysisResponseSchema = z.object({
  gaps: z.array(GapAnalysisItemSchema),
  summary: z.string().optional(),
});

// Body schemas mirroring the inline route schemas (exported so stores/clients
// can use ApiBody<> or direct z.infer<> without importing from route files).
export const CreatePackBodySchema = CreatePackRequestSchema.extend({
  id: z.string(),
  localCreatedAt: z.string().datetime(),
  localUpdatedAt: z.string().datetime(),
});

export const UpdatePackBodySchema = UpdatePackRequestSchema.extend({
  localUpdatedAt: z.string().datetime().optional(),
});

export const PackWeightHistoryResponseSchema = z.object({
  id: z.string(),
  packId: z.string(),
  userId: z.number(),
  weight: z.number(),
  localCreatedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreatePackWeightHistoryBodySchema = z.object({
  id: z.string(),
  weight: z.number(),
  localCreatedAt: z.string().datetime(),
});
