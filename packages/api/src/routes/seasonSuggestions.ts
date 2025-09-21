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
function formatInventoryForAI(items: PackItem[]): string {
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
    with: {
      catalogItem: true,
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
You are a specialized assistant for creating seasonal hiking pack recommendations.

Based on the user's available inventory items, current location, and date, provide 2-3 optimal pack configurations suitable for the current season.

User Location: ${location}
Date: ${date}
Available Inventory Items:
${inventoryFormatted}

Guidelines:
- Focus on essential items for the season conditions
- Create practical pack configurations using ONLY items from the user's inventory
- Explain why each item is recommended for the season/conditions

Respond with a JSON object containing an array of pack suggestions. Each suggestion should have:
- name: descriptive pack name
- description: brief explanation of the pack's purpose
- items: array of items with id, name, quantity, and reason
- season: the season this pack is for
- activityType: type of activity (e.g., "Day Hiking", "Overnight Backpacking")

Example format:
{
  "suggestions": [
    {
      "name": "Summer Day Hike Pack",
      "description": "Perfect for warm summer day hikes",
      "items": [
        {"id": 123, "name": "Water Bottle", "quantity": 2, "reason": "Extra hydration for hot weather"},
        {"id": 456, "name": "Sun Hat", "quantity": 1, "reason": "Protection from UV rays"}
      ],
      "activityType": "Day Hiking"
      }
    ],
    "season": "Summer"
}

Ensure all item IDs match items from the provided inventory list.`;

  // Generate suggestions using AI
  const { OPENAI_API_KEY } = getEnv(c);
  const openai = createOpenAI({
    apiKey: OPENAI_API_KEY,
  });
  const { object } = await generateObject({
    model: openai(DEFAULT_MODELS.OPENAI_CHAT),
    schema: z.object({
      suggestions: z.array(
        z.object({
          name: z.string(),
          description: z.string(),
          items: z.array(
            z.object({
              id: z.number(),
              name: z.string(),
              quantity: z.number().min(1),
              reason: z.string(),
            }),
          ),
          activityType: z.string(),
        }),
      ),
      season: z.string(),
    }),
    system: systemPrompt,
    prompt: 'Generate',
    temperature: 0.8,
  });

  const { suggestions, season } = object;

  return c.json({
    suggestions,
    totalInventoryItems: items.length,
    location,
    season,
  });
});

export { seasonSuggestionsRoutes };
