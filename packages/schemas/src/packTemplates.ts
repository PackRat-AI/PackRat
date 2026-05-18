import { z } from 'zod';
import { ClientUuidSchema } from './packs';
import { datetimeString } from './utils';

export const PackTemplateErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  existingTemplateId: z.string().optional(),
});

export const PackTemplateSchema = z.object({
  id: z.string(),
  clientUuid: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  userId: z.string(),
  image: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  isAppTemplate: z.boolean(),
  deleted: z.boolean(),
  localCreatedAt: datetimeString,
  localUpdatedAt: datetimeString,
  createdAt: datetimeString,
  updatedAt: datetimeString,
  contentSource: z.string().nullable(),
  contentId: z.string().nullable(),
});

export const PackTemplateItemSchema = z.object({
  id: z.string(),
  clientUuid: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  weight: z.number(),
  weightUnit: z.string(),
  quantity: z.number(),
  category: z.string().nullable(),
  consumable: z.boolean(),
  worn: z.boolean(),
  image: z.string().nullable(),
  notes: z.string().nullable(),
  packTemplateId: z.string(),
  catalogItemId: z.number().nullable(),
  userId: z.string(),
  deleted: z.boolean(),
  createdAt: datetimeString,
  updatedAt: datetimeString,
});

export const PackTemplateWithItemsSchema = PackTemplateSchema.extend({
  items: z.array(PackTemplateItemSchema),
});

// `id` is legacy (Phase 1 compat shim — docs/design/client-uuid-split.md §5.4).
// `clientUuid` is the new idempotency token. Both optional; server mints.
export const CreatePackTemplateRequestSchema = z.object({
  id: z.string().optional(),
  clientUuid: ClientUuidSchema.optional(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  category: z.string().min(1),
  image: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
  isAppTemplate: z.boolean().optional(),
  localCreatedAt: z.string().datetime(),
  localUpdatedAt: z.string().datetime(),
});

export const UpdatePackTemplateRequestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable(),
  category: z.string().min(1).optional(),
  image: z.string().url().nullable(),
  tags: z.array(z.string()).nullable(),
  isAppTemplate: z.boolean().optional(),
  deleted: z.boolean().optional(),
  localUpdatedAt: z.string().datetime().optional(),
});

export const CreatePackTemplateItemRequestSchema = z.object({
  id: z.string().optional(),
  clientUuid: ClientUuidSchema.optional(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  weight: z.number().min(0),
  weightUnit: z.enum(['g', 'kg', 'lb', 'oz']),
  quantity: z.number().int().min(1).optional(),
  category: z.string().optional(),
  consumable: z.boolean().optional(),
  worn: z.boolean().optional(),
  image: z.string().nullish(),
  notes: z.string().optional(),
});

export const UpdatePackTemplateItemRequestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  weight: z.number().min(0).optional(),
  weightUnit: z.enum(['g', 'kg', 'lb', 'oz']).optional(),
  quantity: z.number().int().min(1).optional(),
  category: z.string().optional(),
  consumable: z.boolean().optional(),
  worn: z.boolean().optional(),
  image: z.string().url().optional(),
  notes: z.string().optional(),
  deleted: z.boolean().optional(),
});

export const GenerateFromOnlineContentRequestSchema = z.object({
  contentUrl: z.string().url(),
  isAppTemplate: z.boolean().optional(),
});

export const GenerateFromOnlineContentResponseSchema = PackTemplateWithItemsSchema;

export const AIPackAnalysisItemSchema = z.object({
  name: z.string(),
  description: z.string(),
  quantity: z.number().int().positive().default(1),
  category: z.string(),
  weightGrams: z.number().nonnegative().default(0),
  consumable: z.boolean().default(false),
  worn: z.boolean().default(false),
});

export const AIPackAnalysisSchema = z.object({
  templateName: z.string(),
  templateCategory: z.enum([
    'hiking',
    'backpacking',
    'camping',
    'climbing',
    'winter',
    'desert',
    'custom',
    'water sports',
    'skiing',
  ]),
  templateDescription: z.string(),
  items: z.array(AIPackAnalysisItemSchema),
});
