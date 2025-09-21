import { createOpenAI } from '@ai-sdk/openai';
import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { type PackItem, packItems } from '@packrat/api/db/schema';
import {
  ErrorResponseSchema,
  SeasonSuggestionsRequestSchema,
  SeasonSuggestionsResponseSchema,
} from '@packrat/api/schemas/seasonSuggestions';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { getEnv } from '@packrat/api/utils/env-validation';
import { generateObject } from 'ai';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { DEFAULT_MODELS } from '../utils/ai/models';

const seasonSuggestionsRoutes = new OpenAPIHono<{
  Bindings: Env;
  Variables: Variables;
}>();

/**
 * Formats user inventory items for AI processing
 */
function formatInventoryForAI(items: Omit<PackItem, 'embedding'>[]): string {
  return items
    .map(
      (item) =>
        `- ID: ${item.id}, Name: ${item.name} (${item.weight}${item.weightUnit}, Category: ${item.category || 'general'})`,
    )
    .join('\n');
}

const seasonSuggestionsRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Season Suggestions'],
  summary: 'Get seasonal pack suggestions',
  description:
    'Generate personalized pack recommendations based on user inventory, location, and seasonal context',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: SeasonSuggestionsRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Season-appropriate pack suggestions',
      content: {
        'application/json': {
          schema: SeasonSuggestionsResponseSchema,
        },
      },
    },
    400: {
      description: 'Bad request - Insufficient inventory or invalid request',
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

seasonSuggestionsRoutes.openapi(seasonSuggestionsRoute, async (c) => {
  const auth = c.get('user');
  const { location, date } = await c.req.json();
  const db = createDb(c);

  // Get user's inventory items (all pack items across all packs owned by user)
  // We're getting all pack items to represent the user's total inventory
  const items = await db.query.packItems.findMany({
    where: and(eq(packItems.userId, auth.userId), eq(packItems.deleted, false)),
    columns: {
      embedding: false,
    },
  });

  if (items.length < 20) {
    return c.json(
      {
        error: `Insufficient inventory items. You have ${items.length} items, but need at least 20 items to generate seasonal suggestions.`,
      },
      400,
    );
  }

  const inventoryFormatted = formatInventoryForAI(items);

  // Build AI prompt for seasonal pack suggestions
  const systemPrompt = `
You are a specialized assistant for creating seasonal advencture pack recommendations.

Based on the user's available inventory items, current location, and date, provide 2-3 optimal pack configurations suitable for the current season.

User Location: ${location}
Date: ${date}
Available Inventory Items:
${inventoryFormatted}`;

  // Generate suggestions using AI
  const { OPENAI_API_KEY } = getEnv(c);
  const openai = createOpenAI({
    apiKey: OPENAI_API_KEY,
  });
  const { object } = await generateObject({
    model: openai(DEFAULT_MODELS.OPENAI_CHAT),
    schema: z.object({
      season: z.string(),
      suggestions: z.array(
        z.object({
          name: z.string(),
          description: z.string(),
          category: z.string(),
          tags: z.array(z.string()).optional(),
          items: z.array(
            z.object({
              id: z.string().describe('Inventory item ID'),
              name: z.string(),
              quantity: z.number().min(1),
              reason: z.string(),
            }),
          ),
        }),
      ),
    }),
    system: systemPrompt,
    prompt: 'Generate',
    temperature: 0.8,
  });

  const suggestions = object.suggestions.map((suggestion) => ({
    ...suggestion,
    items: suggestion.items
      .map((item) => {
        const invItem = items.find((invItem) => invItem.id === item.id);

        if (!invItem) {
          return undefined;
        }

        return {
          name: invItem.name,
          description: invItem.description ?? null,
          weight: invItem.weight,
          weightUnit: invItem.weightUnit,
          quantity: item.quantity,
          category: invItem.category,
          consumable: invItem.consumable,
          worn: invItem.worn,
          image: invItem.image,
          notes: item.reason,
          catalogItemId: invItem.catalogItemId,
        };
      })
      .filter((item): item is NonNullable<typeof item> => !!item),
  }));

  return c.json(
    {
      suggestions,
      totalInventoryItems: items.length,
      location,
      season: object.season,
    },
    200,
  );
});

export { seasonSuggestionsRoutes };
