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

export const PackTemplateSchema = z
  .object({
    id: z.string().openapi({ example: 'pt_123456', description: 'Unique template identifier' }),
    name: z
      .string()
      .openapi({ example: 'Weekend Backpacking Template', description: 'Template name' }),
    description: z.string().nullable().openapi({
      example: 'Essential gear for a 2-3 day backpacking trip',
      description: 'Template description',
    }),
    category: z.string().openapi({ example: 'Backpacking', description: 'Template category' }),
    userId: z
      .number()
      .openapi({ example: 123, description: 'ID of the user who created this template' }),
    image: z.string().nullable().openapi({
      example: 'https://example.com/template-image.jpg',
      description: 'Template image URL',
    }),
    tags: z
      .array(z.string())
      .nullable()
      .openapi({
        example: ['backpacking', 'weekend', 'hiking'],
        description: 'Template tags for categorization',
      }),
    isAppTemplate: z.boolean().openapi({
      example: false,
      description: 'Whether this is an official app template',
    }),
    deleted: z.boolean().openapi({
      example: false,
      description: 'Whether this template is marked as deleted',
    }),
    localCreatedAt: z.string().datetime().openapi({
      example: '2024-01-01T10:00:00Z',
      description: 'When the template was created locally',
    }),
    localUpdatedAt: z.string().datetime().openapi({
      example: '2024-01-01T12:00:00Z',
      description: 'When the template was last updated locally',
    }),
    createdAt: z.string().datetime().openapi({
      example: '2024-01-01T10:00:00Z',
      description: 'When the template was created on the server',
    }),
    updatedAt: z.string().datetime().openapi({
      example: '2024-01-01T12:00:00Z',
      description: 'When the template was last updated on the server',
    }),
  })
  .openapi('PackTemplate');

export const PackTemplateItemSchema = z
  .object({
    id: z.string().openapi({ example: 'pti_123456', description: 'Unique item identifier' }),
    name: z.string().openapi({ example: 'Tent - 2 Person', description: 'Item name' }),
    description: z.string().nullable().openapi({
      example: 'Lightweight 2-person backpacking tent',
      description: 'Item description',
    }),
    weight: z.number().openapi({ example: 1.2, description: 'Item weight' }),
    weightUnit: z.string().openapi({ example: 'kg', description: 'Weight unit (g, kg, lb, oz)' }),
    quantity: z.number().openapi({ example: 1, description: 'Quantity of this item' }),
    category: z.string().nullable().openapi({
      example: 'Shelter',
      description: 'Item category',
    }),
    consumable: z.boolean().openapi({
      example: false,
      description: 'Whether this item is consumable',
    }),
    worn: z.boolean().openapi({
      example: false,
      description: 'Whether this item is worn (not carried)',
    }),
    image: z.string().nullable().openapi({
      example: 'https://example.com/tent.jpg',
      description: 'Item image URL',
    }),
    notes: z.string().nullable().openapi({
      example: 'Great for summer conditions',
      description: 'Additional notes about the item',
    }),
    packTemplateId: z.string().openapi({
      example: 'pt_123456',
      description: 'ID of the template this item belongs to',
    }),
    catalogItemId: z.number().nullable().openapi({
      example: 789,
      description: 'ID of the associated catalog item',
    }),
    userId: z.number().openapi({ example: 123, description: 'ID of the user who added this item' }),
    deleted: z.boolean().openapi({
      example: false,
      description: 'Whether this item is marked as deleted',
    }),
    createdAt: z.string().datetime().openapi({
      example: '2024-01-01T10:00:00Z',
      description: 'When the item was created',
    }),
    updatedAt: z.string().datetime().openapi({
      example: '2024-01-01T12:00:00Z',
      description: 'When the item was last updated',
    }),
  })
  .openapi('PackTemplateItem');

export const PackTemplateWithItemsSchema = PackTemplateSchema.extend({
  items: z.array(PackTemplateItemSchema).openapi({
    description: 'List of items in this template',
  }),
}).openapi('PackTemplateWithItems');

export const CreatePackTemplateRequestSchema = z
  .object({
    id: z.string().openapi({ example: 'pt_123456', description: 'Unique template identifier' }),
    name: z.string().min(1).max(255).openapi({
      example: 'Weekend Backpacking Template',
      description: 'Template name',
    }),
    description: z.string().optional().openapi({
      example: 'Essential gear for a 2-3 day backpacking trip',
      description: 'Template description',
    }),
    category: z.string().min(1).openapi({
      example: 'Backpacking',
      description: 'Template category',
    }),
    image: z.string().url().optional().openapi({
      example: 'https://example.com/template-image.jpg',
      description: 'Template image URL',
    }),
    tags: z
      .array(z.string())
      .optional()
      .openapi({
        example: ['backpacking', 'weekend', 'hiking'],
        description: 'Template tags for categorization',
      }),
    isAppTemplate: z.boolean().optional().openapi({
      example: false,
      description: 'Whether this is an official app template (admin only)',
    }),
    localCreatedAt: z.string().datetime().openapi({
      example: '2024-01-01T10:00:00Z',
      description: 'When the template was created locally',
    }),
    localUpdatedAt: z.string().datetime().openapi({
      example: '2024-01-01T12:00:00Z',
      description: 'When the template was last updated locally',
    }),
  })
  .openapi('CreatePackTemplateRequest');

export const UpdatePackTemplateRequestSchema = z
  .object({
    name: z.string().min(1).max(255).optional().openapi({
      example: 'Weekend Backpacking Template',
      description: 'Template name',
    }),
    description: z.string().optional().openapi({
      example: 'Essential gear for a 2-3 day backpacking trip',
      description: 'Template description',
    }),
    category: z.string().min(1).optional().openapi({
      example: 'Backpacking',
      description: 'Template category',
    }),
    image: z.string().url().optional().openapi({
      example: 'https://example.com/template-image.jpg',
      description: 'Template image URL',
    }),
    tags: z
      .array(z.string())
      .optional()
      .openapi({
        example: ['backpacking', 'weekend', 'hiking'],
        description: 'Template tags for categorization',
      }),
    isAppTemplate: z.boolean().optional().openapi({
      example: false,
      description: 'Whether this is an official app template (admin only)',
    }),
    deleted: z.boolean().optional().openapi({
      example: false,
      description: 'Whether this template is marked as deleted',
    }),
    localUpdatedAt: z.string().datetime().optional().openapi({
      example: '2024-01-01T12:00:00Z',
      description: 'When the template was last updated locally',
    }),
  })
  .openapi('UpdatePackTemplateRequest');

export const CreatePackTemplateItemRequestSchema = z
  .object({
    id: z.string().openapi({ example: 'pti_123456', description: 'Unique item identifier' }),
    name: z.string().min(1).max(255).openapi({
      example: 'Tent - 2 Person',
      description: 'Item name',
    }),
    description: z.string().optional().openapi({
      example: 'Lightweight 2-person backpacking tent',
      description: 'Item description',
    }),
    weight: z.number().min(0).openapi({ example: 1.2, description: 'Item weight' }),
    weightUnit: z.enum(['g', 'kg', 'lb', 'oz']).openapi({
      example: 'kg',
      description: 'Weight unit',
    }),
    quantity: z.number().int().min(1).optional().default(1).openapi({
      example: 1,
      description: 'Quantity of this item',
    }),
    category: z.string().optional().openapi({
      example: 'Shelter',
      description: 'Item category',
    }),
    consumable: z.boolean().optional().default(false).openapi({
      example: false,
      description: 'Whether this item is consumable',
    }),
    worn: z.boolean().optional().default(false).openapi({
      example: false,
      description: 'Whether this item is worn (not carried)',
    }),
    image: z.string().url().optional().openapi({
      example: 'https://example.com/tent.jpg',
      description: 'Item image URL',
    }),
    notes: z.string().optional().openapi({
      example: 'Great for summer conditions',
      description: 'Additional notes about the item',
    }),
  })
  .openapi('CreatePackTemplateItemRequest');

export const UpdatePackTemplateItemRequestSchema = z
  .object({
    name: z.string().min(1).max(255).optional().openapi({
      example: 'Tent - 2 Person',
      description: 'Item name',
    }),
    description: z.string().optional().openapi({
      example: 'Lightweight 2-person backpacking tent',
      description: 'Item description',
    }),
    weight: z.number().min(0).optional().openapi({ example: 1.2, description: 'Item weight' }),
    weightUnit: z.enum(['g', 'kg', 'lb', 'oz']).optional().openapi({
      example: 'kg',
      description: 'Weight unit',
    }),
    quantity: z.number().int().min(1).optional().openapi({
      example: 1,
      description: 'Quantity of this item',
    }),
    category: z.string().optional().openapi({
      example: 'Shelter',
      description: 'Item category',
    }),
    consumable: z.boolean().optional().openapi({
      example: false,
      description: 'Whether this item is consumable',
    }),
    worn: z.boolean().optional().openapi({
      example: false,
      description: 'Whether this item is worn (not carried)',
    }),
    image: z.string().url().optional().openapi({
      example: 'https://example.com/tent.jpg',
      description: 'Item image URL',
    }),
    notes: z.string().optional().openapi({
      example: 'Great for summer conditions',
      description: 'Additional notes about the item',
    }),
    deleted: z.boolean().optional().openapi({
      example: false,
      description: 'Whether this item is marked as deleted',
    }),
  })
  .openapi('UpdatePackTemplateItemRequest');

export const SuccessResponseSchema = z
  .object({
    success: z.boolean().openapi({
      example: true,
      description: 'Indicates if the operation was successful',
    }),
  })
  .openapi('SuccessResponse');
