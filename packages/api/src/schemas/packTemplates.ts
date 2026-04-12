import { z } from 'zod';

export const ErrorResponseSchema = z
  .object({
    error: z.string(),
    code: z.string().optional(),
    existingTemplateId: z.string().optional(),
  })

export const PackTemplateSchema = z
  .object({
    id: z.string(),
    name: z
      .string()
      ,
    description: z.string().nullable(),
    category: z.string(),
    userId: z
      .number()
      ,
    image: z.string().nullable(),
    tags: z
      .array(z.string())
      .nullable()
      ,
    isAppTemplate: z.boolean(),
    deleted: z.boolean(),
    localCreatedAt: z.string().datetime(),
    localUpdatedAt: z.string().datetime(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    contentSource: z.string().nullable(),
    contentId: z.string().nullable(),
  })

export const PackTemplateItemSchema = z
  .object({
    id: z.string(),
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
    userId: z.number(),
    deleted: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })

export const PackTemplateWithItemsSchema = PackTemplateSchema.extend({
  items: z.array(PackTemplateItemSchema),
});

export const CreatePackTemplateRequestSchema = z
  .object({
    id: z.string(),
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    category: z.string().min(1),
    image: z.string().url().optional(),
    tags: z
      .array(z.string())
      .optional()
      ,
    isAppTemplate: z.boolean().optional(),
    localCreatedAt: z.string().datetime(),
    localUpdatedAt: z.string().datetime(),
  })

export const UpdatePackTemplateRequestSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().nullable(),
    category: z.string().min(1).optional(),
    image: z.string().url().nullable(),
    tags: z
      .array(z.string())
      .nullable()
      ,
    isAppTemplate: z.boolean().optional(),
    deleted: z.boolean().optional(),
    localUpdatedAt: z.string().datetime().optional(),
  })

export const CreatePackTemplateItemRequestSchema = z
  .object({
    id: z.string(),
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    weight: z.number().min(0),
    weightUnit: z.enum(['g', 'kg', 'lb', 'oz']),
    quantity: z.number().int().min(1).optional().default(1),
    category: z.string().optional(),
    consumable: z.boolean().optional().default(false),
    worn: z.boolean().optional().default(false),
    image: z.string().nullish(),
    notes: z.string().optional(),
  })

export const UpdatePackTemplateItemRequestSchema = z
  .object({
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
  })

export const SuccessResponseSchema = z
  .object({
    success: z.boolean(),
  })

export const GenerateFromOnlineContentRequestSchema = z
  .object({
    contentUrl: z.string().url(),
    isAppTemplate: z.boolean().optional().default(true),
  })

export const GenerateFromOnlineContentResponseSchema = PackTemplateWithItemsSchema;
