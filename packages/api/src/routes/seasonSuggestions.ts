import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { packItems } from '@packrat/api/db/schema';
import {
  ErrorResponseSchema,
  SeasonSuggestionsRequestSchema,
  SeasonSuggestionsResponseSchema,
} from '@packrat/api/schemas/seasonSuggestions';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { createAIProvider } from '@packrat/api/utils/ai/provider';
import { getEnv } from '@packrat/api/utils/env-validation';
import { eq } from 'drizzle-orm';
import { DEFAULT_MODELS } from '../utils/ai/models';

const seasonSuggestionsRoutes = new OpenAPIHono<{
  Bindings: Env;
  Variables: Variables;
}>();

/**
 * Determines the season based on date and location
 */
function getSeason(date: string, location: string): string {
  const dateObj = new Date(date);
  const month = dateObj.getMonth() + 1; // getMonth() returns 0-11

  // Basic season determination for Northern Hemisphere (can be enhanced with location-specific logic)
  if (month >= 3 && month <= 5) return 'Spring';
  if (month >= 6 && month <= 8) return 'Summer';
  if (month >= 9 && month <= 11) return 'Fall';
  return 'Winter';
}

/**
 * Formats user inventory items for AI processing
 */
function formatInventoryForAI(items: any[]): string {
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

  try {
    const db = createDb(c);

    // Get user's inventory items (all pack items across all packs owned by user)
    // We're getting all pack items to represent the user's total inventory
    const userItems = await db.query.packItems.findMany({
      where: eq(packItems.userId, auth.userId),
      with: {
        catalogItem: true,
      },
    });

    // Filter out deleted items and ensure we have the minimum required
    const activeItems = userItems.filter((item) => !item.deleted);

    if (activeItems.length < 20) {
      return c.json(
        {
          error: `Insufficient inventory items. You have ${activeItems.length} items, but need at least 20 items to generate seasonal suggestions.`,
        },
        400,
      );
    }

    const season = getSeason(date, location);
    const inventoryFormatted = formatInventoryForAI(activeItems);

    // Build AI prompt for seasonal pack suggestions
    const systemPrompt = `
You are PackRat AI, a specialized assistant for creating seasonal hiking pack recommendations.

Based on the user's available inventory items, current location, and date, provide 2-3 optimal pack configurations suitable for the current season.

User Location: ${location}
Date: ${date}
Season: ${season}
Available Inventory Items:
${inventoryFormatted}

Guidelines:
- Consider the ${season.toLowerCase()} season and typical weather conditions in ${location}
- Create practical pack configurations using ONLY items from the user's inventory
- Each pack should serve different activity types (day hike, overnight, weekend trip, etc.)
- Explain why each item is recommended for the season/conditions
- Focus on essential items for ${season.toLowerCase()} conditions
- Consider weight efficiency and multi-use items

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
      "season": "Summer",
      "activityType": "Day Hiking"
    }
  ]
}

Ensure all item IDs match items from the provided inventory list.`;

    const { AI_PROVIDER, OPENAI_API_KEY, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_AI_GATEWAY_ID, AI } =
      getEnv(c);

    const aiProvider = createAIProvider({
      openAiApiKey: OPENAI_API_KEY,
      provider: AI_PROVIDER,
      cloudflareAccountId: CLOUDFLARE_ACCOUNT_ID,
      cloudflareGatewayId: CLOUDFLARE_AI_GATEWAY_ID,
      cloudflareAiBinding: AI,
    });

    if (!aiProvider) {
      return c.json({ error: 'AI provider not configured' }, 500);
    }

    // Generate suggestions using AI
    const model = aiProvider(DEFAULT_MODELS.OPENAI_CHAT);

    const result = await model.generate({
      prompt: systemPrompt,
      temperature: 0.7,
      maxOutputTokens: 2000,
    });

    let suggestions;
    try {
      // Parse AI response as JSON
      const aiResponse = result.response.text;
      const parsed = JSON.parse(aiResponse);
      suggestions = Array.isArray(parsed) ? parsed : parsed.suggestions || [];
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return c.json({ error: 'Failed to generate valid suggestions' }, 500);
    }

    return c.json({
      suggestions,
      totalInventoryItems: activeItems.length,
      location,
      season,
    });
  } catch (error) {
    console.error('Season suggestions error:', error);
    c.get('sentry').setContext('seasonSuggestions', {
      location,
      date,
      userId: auth.userId,
    });
    c.get('sentry').captureException(error);

    return c.json({ error: 'Failed to generate season suggestions' }, 500);
  }
});

export { seasonSuggestionsRoutes };
