import {
  AIService,
  CatalogService,
  PackItemService,
  PackService,
  WeatherService,
} from '@packrat/api/services';
import { executeSqlAiTool } from '@packrat/api/services/executeSqlAiTool';
import { tool } from 'ai';
import type { Context } from 'hono';
import { z } from 'zod';

export function createTools(c: Context, userId: number) {
  const packService = new PackService(c, userId);
  const packItemService = new PackItemService(c, userId);
  const weatherService = new WeatherService(c);
  const catalogService = new CatalogService(c);
  const aiService = new AIService(c);

  const sentry = c.get('sentry');

  return {
    getPackDetails: tool({
      description:
        'Get detailed information about a specific pack including all items, weights, and categories.',
      inputSchema: z.object({
        packId: z.string().describe('The ID of the pack to get details for'),
      }),
      execute: async ({ packId }) => {
        try {
          const pack = await packService.getPackDetails(packId);

          if (!pack) {
            return {
              success: false,
              error: 'Pack not found',
            };
          }

          const categories = Array.from(
            new Set(pack.items.map((item) => item.category || 'Uncategorized')),
          );

          return {
            success: true,
            data: {
              ...pack,
              categories,
            },
          };
        } catch (error) {
          console.error('getPackDetails tool error', error);
          sentry.setTag('location', 'ai-tool-call/getPackDetails');
          sentry.setContext('meta', { packId });
          sentry.captureException(error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get pack details',
          };
        }
      },
    }),

    getPackItemDetails: tool({
      description:
        'Get detailed information about a specific item in a pack including its catalog details.',
      inputSchema: z.object({
        itemId: z.string().describe('The ID of the item to get details for'),
      }),
      execute: async ({ itemId }) => {
        try {
          const item = await packItemService.getPackItemDetails(itemId);
          if (!item) {
            return {
              success: false,
              error: 'Item not found',
            };
          }
          return {
            success: true,
            data: item,
          };
        } catch (error) {
          console.error('getPackItemDetails tool error', error);
          sentry.setTag('location', 'ai-tool-call/getPackItemDetails');
          sentry.setContext('meta', { itemId });
          sentry.captureException(error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get item details',
          };
        }
      },
    }),

    getWeatherForLocation: tool({
      description: 'Get current weather information a specific location.',
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
              ...weatherData,
            },
          };
        } catch (error) {
          console.error('getWeatherForLocation tool error', error);
          sentry.setTag('location', 'ai-tool-call/getWeatherForLocation');
          sentry.setContext('meta', { location });
          sentry.captureException(error);
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
          return {
            success: true,
            data,
          };
        } catch (error) {
          console.error('getCatalogItems tool error', error);
          sentry.setTag('location', 'ai-tool-call/getCatalogItems');
          sentry.setContext('meta', { query, category, limit, offset });
          sentry.captureException(error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to retrieve catalog items',
          };
        }
      },
    }),

    semanticCatalogSearch: tool({
      description: 'Search the comprehensive gear database using semantic search.',
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
          const data = await catalogService.semanticSearch(query, limit || 10, offset || 0);
          return {
            success: true,
            data,
          };
        } catch (error) {
          console.error('semanticCatalogSearch tool error', error);
          sentry.setTag('location', 'ai-tool-call/semanticCatalogSearch');
          sentry.setContext('meta', { query });
          sentry.captureException(error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to perform semantic search',
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
          const results = await aiService.searchPackratOutdoorGuidesRAG(query, limit || 5);
          return {
            success: true,
            data: results,
          };
        } catch (error) {
          console.error('searchPackratOutdoorGuidesRAG', error);
          sentry.setTag('location', 'ai-tool-call/searchPackratOutdoorGuidesRAG');
          sentry.setContext('meta', { query });
          sentry.captureException(error);
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

          return {
            data: result,
            success: true,
          };
        } catch (error) {
          console.error('webSearchTool', error);
          sentry.setTag('location', 'ai-tool-call/webSearchTool');
          sentry.setContext('meta', { query });
          sentry.captureException(error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Search failed',
          };
        }
      },
    }),

    catalogSearchForGuides: tool({
      description: 'Search the catalog specifically for generating guide content with item links. Returns items with product URLs that can be included in guides.',
      inputSchema: z.object({
        query: z.string().min(1).describe('Search query for gear items (e.g., "backpack", "sleeping bag")'),
        category: z.string().optional().describe('Optional category filter'),
        limit: z.number().min(1).max(20).optional().describe('Number of results to return (default 10)'),
        minRating: z.number().min(1).max(5).optional().describe('Minimum rating filter (1-5)')
      }),
      execute: async ({ query, category, limit = 10, minRating }) => {
        try {
          const searchResult = await catalogService.semanticSearch(query, limit, 0);
          
          // Filter and format results for guide generation
          const items = searchResult.items
            .filter(item => {
              // Filter by category if specified
              if (category && item.categories && !item.categories.includes(category)) {
                return false;
              }
              // Filter by minimum rating if specified
              if (minRating && (!item.ratingValue || item.ratingValue < minRating)) {
                return false;
              }
              // Ensure we have a valid product URL
              if (!item.productUrl) {
                return false;
              }
              return true;
            })
            .map(item => ({
              id: item.id,
              name: item.name,
              productUrl: item.productUrl,
              brand: item.brand,
              categories: item.categories,
              price: item.price,
              ratingValue: item.ratingValue,
              description: item.description,
            }));

          return {
            success: true,
            items,
            query,
            total: items.length,
            message: `Found ${items.length} catalog items for "${query}"`
          };
        } catch (error) {
          console.error('catalogSearchForGuides tool error', error);
          sentry.setTag('location', 'ai-tool-call/catalogSearchForGuides');
          sentry.setContext('meta', { query, category, limit, minRating });
          sentry.captureException(error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to search catalog for guides',
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
          return await executeSqlAiTool({ query, limit, c, userId });
        } catch (error) {
          console.error('SQL tool error', error);
          sentry.setTag('location', 'ai-tool-call/executeSql');
          sentry.setContext('params', { query, limit });
          sentry.captureException(error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
          };
        }
      },
    }),
  };
}
