import { createDb } from '@packrat/api/db';
import { authPlugin } from '@packrat/api/middleware/auth';
import { createAIProvider } from '@packrat/api/utils/ai/provider';
import { getEnv, isLocalE2EApiEnv } from '@packrat/api/utils/env-validation';
import { type PackItem, packItems } from '@packrat/db';
import { SeasonSuggestionsRequestSchema } from '@packrat/schemas/seasonSuggestions';
import { generateObject } from 'ai';
import { and, eq } from 'drizzle-orm';
import { Elysia, status } from 'elysia';
import { z } from 'zod';
import { DEFAULT_MODELS } from '../utils/ai/models';

const isLocalE2ESeasonSuggestionEnv = (input: {
  openAiApiKey: string | undefined;
  databaseUrl: string;
}) =>
  isLocalE2EApiEnv({
    databaseUrl: input.databaseUrl,
    openAiApiKey: input.openAiApiKey,
    requireStubOpenAI: true,
  });

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
  .model({
    'seasonSuggestions.SeasonSuggestionsRequest': SeasonSuggestionsRequestSchema,
  })
  .use(authPlugin)
  .post(
    '/',
    async ({ body, user }) => {
      const { location, date } = body;
      const {
        OPENAI_API_KEY,
        AI_PROVIDER,
        CLOUDFLARE_ACCOUNT_ID,
        CLOUDFLARE_AI_GATEWAY_ID,
        CLOUDFLARE_API_TOKEN,
        AI,
        NEON_DATABASE_URL,
      } = getEnv();

      if (
        isLocalE2ESeasonSuggestionEnv({
          openAiApiKey: OPENAI_API_KEY,
          databaseUrl: NEON_DATABASE_URL,
        })
      ) {
        const suggestionItems = [
          {
            id: 'e2e-season-rain-shell',
            name: 'Rain shell',
            description: 'Waterproof layer for shoulder-season weather.',
            weight: 210,
            weightUnit: 'g',
            quantity: 1,
            category: 'clothing',
            consumable: false,
            worn: false,
            image: null,
            notes: 'Keep this accessible for changing weather.',
            catalogItemId: null,
          },
          {
            id: 'e2e-season-headlamp',
            name: 'Headlamp',
            description: 'Reliable lighting for short autumn daylight.',
            weight: 85,
            weightUnit: 'g',
            quantity: 1,
            category: 'lighting',
            consumable: false,
            worn: false,
            image: null,
            notes: 'Pack fresh batteries before leaving.',
            catalogItemId: null,
          },
          {
            id: 'e2e-season-warm-layer',
            name: 'Warm layer',
            description: 'Insulating layer for cool evenings and exposed breaks.',
            weight: 320,
            weightUnit: 'g',
            quantity: 1,
            category: 'clothing',
            consumable: false,
            worn: true,
            image: null,
            notes: 'Wear or keep near the top of the pack.',
            catalogItemId: null,
          },
        ];

        return {
          suggestions: [
            {
              name: 'Shoulder Season Overnight',
              description: `Balanced kit for ${location} with warmth, rain protection, and reliable camp basics.`,
              category: 'backpacking',
              tags: ['e2e', 'shoulder season', 'overnight'],
              items: suggestionItems,
            },
          ],
          totalInventoryItems: suggestionItems.length,
          location,
          season: 'fall',
        };
      }

      const db = createDb();
      const items = await db.tag('seasonSuggestions.getUserInventory').query.packItems.findMany({
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

      const aiProvider = createAIProvider({
        openAiApiKey: OPENAI_API_KEY,
        provider: AI_PROVIDER,
        cloudflareAccountId: CLOUDFLARE_ACCOUNT_ID,
        cloudflareGatewayId: CLOUDFLARE_AI_GATEWAY_ID,
        cloudflareApiToken: CLOUDFLARE_API_TOKEN,
        cloudflareAiBinding: AI,
      });
      const { object } = await generateObject({
        model: aiProvider(DEFAULT_MODELS.OPENAI_CHAT),
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
              id: invItem.id,
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
      body: 'seasonSuggestions.SeasonSuggestionsRequest',
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
