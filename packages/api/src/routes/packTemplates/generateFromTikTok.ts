import { createOpenAI } from '@ai-sdk/openai';
import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { packTemplateItems, packTemplates } from '@packrat/api/db/schema';
import {
  ErrorResponseSchema,
  GenerateFromTikTokRequestSchema,
  GenerateFromTikTokResponseSchema,
} from '@packrat/api/schemas/packTemplates';
import { CatalogService } from '@packrat/api/services/catalogService';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { getEnv } from '@packrat/api/utils/env-validation';
import { generateObject } from 'ai';
import { nanoid } from 'nanoid';
import { z } from 'zod';

const SYSTEM_PROMPT = `You are an expert outdoor gear analyst. You will be shown images from a TikTok slideshow featuring packing content (e.g., a gear lay-flat, kit breakdown, or packing list). Your task is to:

1. Identify every outdoor gear or equipment item visible in the images or mentioned in the caption.
2. For each item, provide a specific name, description, category, weight estimate (in grams), quantity, and flags for whether it is consumable or worn.
3. Also determine an appropriate pack template name and category (one of: hiking, backpacking, camping, climbing, winter, desert, custom, water sports, skiing) for this overall kit.

Focus on items that would realistically appear in an outdoor adventure packing list. Be thorough — extract every item you can see or infer.`;

const analysisSchema = z.object({
  templateName: z.string().describe('A concise, descriptive name for this pack template'),
  templateCategory: z
    .enum([
      'hiking',
      'backpacking',
      'camping',
      'climbing',
      'winter',
      'desert',
      'custom',
      'water sports',
      'skiing',
    ])
    .describe('The most appropriate category for this pack template'),
  templateDescription: z.string().describe('A short description of the pack template'),
  items: z
    .array(
      z.object({
        name: z.string().describe('Specific name of the item'),
        description: z
          .string()
          .describe('Brief description including key characteristics, useful for catalog search'),
        quantity: z.number().int().positive().default(1),
        category: z
          .string()
          .describe('Category of outdoor gear (e.g., Sleep System, Clothing, etc.)'),
        weightGrams: z.number().nonnegative().default(0).describe('Estimated weight in grams'),
        consumable: z.boolean().default(false),
        worn: z.boolean().default(false),
      }),
    )
    .describe('All gear items identified from the content'),
});

// POST /pack-templates/generate-from-tiktok
const generateFromTikTokRoute = createRoute({
  method: 'post',
  path: '/generate-from-tiktok',
  tags: ['Pack Templates'],
  summary: 'Generate a pack template from a TikTok slideshow',
  description:
    'Admin-only endpoint that uses AI (GPT-4o) to analyze TikTok slideshow images and build a featured pack template using items from the catalog.',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: GenerateFromTikTokRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      description: 'Pack template generated and created successfully',
      content: {
        'application/json': {
          schema: GenerateFromTikTokResponseSchema,
        },
      },
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - Admin access required',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const generateFromTikTokRoutes = new OpenAPIHono<{
  Bindings: Env;
  Variables: Variables;
}>();

generateFromTikTokRoutes.openapi(generateFromTikTokRoute, async (c) => {
  try {
    const auth = c.get('user');

    if (auth.role !== 'ADMIN') {
      return c.json({ error: 'Forbidden: Admin access required' }, 403);
    }

    const body = c.req.valid('json');
    const { tiktokUrl, imageUrls, caption, name, category, isAppTemplate } = body;

    const { OPENAI_API_KEY } = getEnv(c);
    const openai = createOpenAI({ apiKey: OPENAI_API_KEY });

    // Build message content parts for GPT-4o
    type TextPart = { type: 'text'; text: string };
    type ImagePart = { type: 'image'; image: string };
    const contentParts: Array<TextPart | ImagePart> = [];

    const introText = caption
      ? `TikTok URL: ${tiktokUrl}\nCaption: ${caption}\n\nPlease analyze the following slideshow images and extract all packing/gear items:`
      : `TikTok URL: ${tiktokUrl}\n\nPlease analyze the following slideshow images and extract all packing/gear items:`;

    contentParts.push({ type: 'text', text: introText });

    for (const imageUrl of imageUrls) {
      contentParts.push({ type: 'image', image: imageUrl });
    }

    // Analyze images with GPT-4o
    const { object: analysis } = await generateObject({
      model: openai('gpt-4o'),
      schema: analysisSchema,
      system: SYSTEM_PROMPT,
      prompt: [
        {
          role: 'user',
          content: contentParts,
        },
      ],
      temperature: 0.2,
    });

    // Match each detected item to catalog items using vector search
    const catalogService = new CatalogService(c);

    const searchQueries = analysis.items.map((item) => `${item.name} ${item.description}`.trim());

    const batchResult =
      searchQueries.length > 0
        ? await catalogService.batchVectorSearch(searchQueries, 1)
        : { items: [] as never[] };

    // Prepare DB records
    const db = createDb(c);
    const now = new Date();
    const templateId = `pt_${nanoid()}`;
    const resolvedName = name ?? analysis.templateName;
    const resolvedCategory = category ?? analysis.templateCategory;

    // Insert the pack template
    const [newTemplate] = await db
      .insert(packTemplates)
      .values({
        id: templateId,
        userId: auth.userId,
        name: resolvedName,
        description: analysis.templateDescription,
        category: resolvedCategory,
        image: null,
        tags: [resolvedCategory],
        isAppTemplate: isAppTemplate ?? true,
        deleted: false,
        localCreatedAt: now,
        localUpdatedAt: now,
      })
      .returning();

    // Insert template items — prefer catalog match, fall back to detected item data
    const itemRecords = analysis.items.map((detected, index) => {
      const catalogMatches = batchResult.items[index] ?? [];
      const bestMatch = catalogMatches[0];
      const itemId = `pti_${nanoid()}`;

      return {
        id: itemId,
        packTemplateId: templateId,
        userId: auth.userId,
        name: bestMatch?.name ?? detected.name,
        description: (bestMatch?.description ?? detected.description) || null,
        weight: bestMatch?.weight ?? detected.weightGrams,
        weightUnit: bestMatch?.weightUnit ?? 'g',
        quantity: detected.quantity,
        category: detected.category,
        consumable: detected.consumable,
        worn: detected.worn,
        image: bestMatch?.images?.[0] ?? null,
        notes: null,
        catalogItemId: bestMatch?.id ?? null,
        deleted: false,
      };
    });

    const insertedItems =
      itemRecords.length > 0
        ? await db.insert(packTemplateItems).values(itemRecords).returning()
        : [];

    return c.json({ ...newTemplate, items: insertedItems }, 201);
  } catch (error) {
    console.error('Error generating pack template from TikTok:', error);
    c.get('sentry').captureException(error);

    return c.json(
      {
        error: `Failed to generate template: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      500,
    );
  }
});

export { generateFromTikTokRoutes };
