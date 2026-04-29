import { createOpenAI } from '@ai-sdk/openai';
import { createDb } from '@packrat/api/db';
import { type PackItem, packItems } from '@packrat/api/db/schema';
import { authPlugin } from '@packrat/api/middleware/auth';
import { SeasonSuggestionsRequestSchema } from '@packrat/api/schemas/seasonSuggestions';
import { getEnv } from '@packrat/api/utils/env-validation';
import { generateObject } from 'ai';
import { and, eq } from 'drizzle-orm';
import { Elysia, status } from 'elysia';
import { z } from 'zod';
import { DEFAULT_MODELS } from '../utils/ai/models';

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

export const seasonSuggestionsRoutes = new Elysia({ prefix: '/season-suggestions' })
  .use(authPlugin)
  .post(
    '/',
    async ({ body, user }) => {
      const { location, date } = body;
      const db = createDb();

      const items = await db.query.packItems.findMany({
        where: and(eq(packItems.userId, user.userId), eq(packItems.deleted, false)),
        columns: { embedding: false },
      });

      if (items.length < 20) {
        return status(400, {
          error: `Insufficient inventory items. You have ${items.length} items, but need at least 20 items to generate seasonal suggestions.`,
        });
      }

      const inventoryFormatted = formatInventoryForAI(items);

      const systemPrompt = `
You are a specialized assistant for creating seasonal adventure pack recommendations.

Based on the user's available inventory items, current location, and date, provide 2-3 optimal pack configurations suitable for the current season.

User Location: ${location}
Date: ${date}
Available Inventory Items:
${inventoryFormatted}`;

      const { OPENAI_API_KEY } = getEnv();
      const openai = createOpenAI({ apiKey: OPENAI_API_KEY });
      const { object } = await generateObject({
        model: openai(DEFAULT_MODELS.OPENAI_CHAT),
        schema: z.object({
          season: z.string(),
          suggestions: z.array(
            z.object({
              name: z.string(),
              description: z.string(),
              category: z.string(),
              tags: z.array(z.string()),
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
            if (!invItem) return undefined;
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

      return {
        suggestions,
        totalInventoryItems: items.length,
        location,
        season: object.season,
      };
    },
    {
      body: SeasonSuggestionsRequestSchema,
      isAuthenticated: true,
      detail: {
        tags: ['Season Suggestions'],
        summary: 'Get seasonal pack suggestions',
        description:
          'Generate personalized pack recommendations based on user inventory, location, and seasonal context',
        security: [{ bearerAuth: [] }],
      },
    },
  );
