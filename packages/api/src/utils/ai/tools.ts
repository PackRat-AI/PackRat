import { AIService, CatalogService, WeatherService } from '@packrat/api/services';
import { executeSqlAiTool } from '@packrat/api/services/executeSqlAiTool';
import { z } from 'zod';

export async function createTools(userId: string) {
  const { tool } = await import('ai');
  const weatherService = new WeatherService();
  const catalogService = new CatalogService();
  const aiService = new AIService();

  return {
    // ── Tools over the user's own packs and items ────────────────────────
    //
    // These are declared with no `execute`, so the model's call is streamed to
    // the client and answered from the device's local store.
    //
    // That placement is deliberate. The local store is what the user is
    // actually looking at, and it is the write path: mutations land there
    // first and sync outward through the outbox. A server-side version of
    // these would read and write Postgres behind the UI's back — an item the
    // assistant "added" would not appear until the next refresh, and nothing
    // would work offline.
    listUserPacks: tool({
      description:
        "List the signed-in user's own packs. Use this to resolve a pack the user mentions by " +
        'NAME (for example "my Japan Trip pack") into a pack id before calling getPackDetails ' +
        'or addItemToPack. Returns id, name, category and description for each match. ' +
        "Executed client-side from local device data, so it sees packs that haven't synced yet.",
      inputSchema: z.object({
        nameQuery: z
          .string()
          .optional()
          .describe(
            'Optional fuzzy/partial name filter, matched case-insensitively against the pack ' +
              "name. Omit to list all of the user's packs.",
          ),
      }),
    }),

    getPackDetails: tool({
      description:
        'Get detailed information about a specific pack including all items, weights, and categories. Executed client-side from local device data.',
      inputSchema: z.object({
        packId: z.string().describe('The ID of the pack to get details for'),
      }),
    }),

    getPackItemDetails: tool({
      description:
        'Get detailed information about a specific item in a pack including its catalog details. Executed client-side from local device data.',
      inputSchema: z.object({
        itemId: z.string().describe('The ID of the item to get details for'),
      }),
    }),

    addItemToPack: tool({
      description:
        "Add a gear item to one of the signed-in user's packs. Resolve the pack by name with " +
        'listUserPacks first and pass its id — never guess a pack id. Prefer filling in weight ' +
        'and category from a catalog lookup (getCatalogItems or catalogVectorSearch) so the ' +
        "pack's weight totals stay meaningful; pass catalogItemId when the item came from the " +
        'catalog. Executed client-side, so the item appears in the app immediately and syncs ' +
        'when the device is next online.',
      inputSchema: z.object({
        packId: z.string().describe('The ID of the pack to add the item to'),
        name: z.string().describe('Name of the item, for example "Merino T-Shirt"'),
        weight: z
          .number()
          .optional()
          .describe('Weight of a single unit, in the unit given by weightUnit'),
        weightUnit: z
          .enum(['g', 'kg', 'oz', 'lb'])
          .optional()
          .describe('Unit for weight. Required when weight is given.'),
        quantity: z.number().int().min(1).optional().describe('How many to add. Defaults to 1.'),
        category: z
          .string()
          .optional()
          .describe('Category such as clothing, shelter, cooking, electronics'),
        consumable: z
          .boolean()
          .optional()
          .describe('True for items used up on the trip, such as food or fuel'),
        worn: z.boolean().optional().describe('True for items worn rather than carried'),
        notes: z.string().optional().describe('Optional free-text notes'),
        catalogItemId: z
          .string()
          .optional()
          .describe('Catalog item id, when this item was chosen from the gear catalog'),
      }),
    }),

    getWeatherForLocation: tool({
      description: 'Get current weather information for a specific location.',
      inputSchema: z.object({
        location: z
          .string()
          .describe('Location to get weather for (city, state, coordinates, or trail name)'),
      }),
      execute: async ({ location }) => {
        try {
          const weatherData = await weatherService.getWeatherForLocation(location);
          return {
            success: true,
            data: {
              name: weatherData.location,
              temperature: weatherData.temperature,
              condition: weatherData.conditions,
              details: {
                humidity: weatherData.humidity,
                windSpeed: weatherData.windSpeed,
              },
            },
          };
        } catch (error) {
          console.error('getWeatherForLocation tool error', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get weather data',
          };
        }
      },
    }),

    getCatalogItems: tool({
      description:
        'Retrieve items from the comprehensive gear database with optional filters or search criteria.',
      inputSchema: z.object({
        query: z.string().optional().describe('Optional search query to filter catalog items'),
        category: z.string().optional().describe('Optional category to filter catalog items'),
        limit: z
          .number()
          .min(1)
          .max(100)
          .optional()
          .describe('Optional limit for number of results to return'),
        offset: z.number().min(0).optional().describe('Optional offset for pagination of results'),
      }),
      execute: async ({ query, category, limit, offset }) => {
        try {
          const data = await catalogService.getCatalogItems({
            q: query,
            category,
            limit: limit || 10,
            offset: offset || 0,
          });
          return { success: true, data };
        } catch (error) {
          console.error('getCatalogItems tool error', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to retrieve catalog items',
          };
        }
      },
    }),

    catalogVectorSearch: tool({
      description: 'Search the comprehensive gear database using vector search.',
      inputSchema: z.object({
        query: z.string().min(1).describe('Search query to find catalog items'),
        limit: z
          .number()
          .min(1)
          .max(100)
          .optional()
          .describe('Optional limit for number of results to return'),
        offset: z.number().min(0).optional().describe('Optional offset for pagination of results'),
      }),
      execute: async ({ query, limit, offset }) => {
        try {
          const data = await catalogService.vectorSearch({
            q: query,
            opts: {
              limit: limit || 10,
              offset: offset || 0,
            },
          });
          return { success: true, data };
        } catch (error) {
          console.error('catalogVectorSearch tool error', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to perform vector search',
          };
        }
      },
    }),

    searchPackratOutdoorGuidesRAG: tool({
      description:
        'Search the Packrat outdoor guides knowledge base using RAG (Retrieval-Augmented Generation).',
      inputSchema: z.object({
        query: z.string().min(1).describe('Search query for outdoor guides'),
        limit: z
          .number()
          .min(1)
          .max(100)
          .optional()
          .describe('Optional limit for number of results to return'),
      }),
      execute: async ({ query, limit }) => {
        try {
          const results = await aiService.searchPackratOutdoorGuidesRAG({
            query,
            limit: limit || 5,
          });
          return { success: true, data: results };
        } catch (error) {
          console.error('searchPackratOutdoorGuidesRAG', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to search outdoor guides',
          };
        }
      },
    }),

    webSearchTool: tool({
      description: `Search the web for current information, news, deals, recommendations, and real-time data.
        Use this when users ask about:
        - Current events or recent news
        - Product deals, prices, or reviews
        - Travel recommendations (trails, hikes, destinations)
        - Weather conditions
        - Recent developments in any field
        - Anything requiring up-to-date information`,
      inputSchema: z.object({
        query: z.string().describe('The search query - be specific and include relevant keywords'),
      }),
      execute: async ({ query }) => {
        try {
          const result = await aiService.perplexitySearch(query);
          return { data: result, success: true };
        } catch (error) {
          console.error('webSearchTool', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Search failed',
          };
        }
      },
    }),

    executeSql: tool({
      description:
        'Execute read-only SQL queries against the database. Only SELECT statements are allowed.',
      inputSchema: z.object({
        query: z
          .string()
          .describe('SQL SELECT statement to execute. Must be a valid SELECT query.'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(1000)
          .default(100)
          .describe('Maximum number of rows to return (default: 100, max: 1000)'),
      }),
      execute: async ({ query, limit = 100 }) => {
        try {
          return await executeSqlAiTool({ query, limit, userId });
        } catch (error) {
          console.error('SQL tool error', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
          };
        }
      },
    }),
  };
}
