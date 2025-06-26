import { tool } from 'ai';
import { z } from 'zod';
import {
  PackService,
  WeatherService,
  PackItemService,
  CatalogService,
} from '@packrat/api/services';
import type { Context } from 'hono';

export function createTools(c: Context, userId: number) {
  const packService = new PackService(c, userId);
  const packItemService = new PackItemService(c, userId);
  const weatherService = new WeatherService(c);
  const catalogService = new CatalogService(c);

  const sentry = c.get('sentry');

  return {
    getPackDetails: tool({
      description:
        'Get detailed information about a specific pack including all items, weights, and categories.',
      parameters: z.object({
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
            new Set(pack.items.map((item) => item.category || 'Uncategorized'))
          );

          return {
            success: true,
            pack: {
              ...pack,
              categories,
            },
          };
        } catch (error) {
          sentry.setTag('location', 'ai-tool-call/getPackDetails');
          sentry.setContext('meta', { packId });
          sentry.captureException(error);
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to get pack details',
          };
        }
      },
    }),

    getPackItemDetails: tool({
      description:
        'Get detailed information about a specific item in a pack including its catalog details.',
      parameters: z.object({
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
            item,
          };
        } catch (error) {
          sentry.setTag('location', 'ai-tool-call/getPackItemDetails');
          sentry.setContext('meta', { itemId });
          sentry.captureException(error);
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to get item details',
          };
        }
      },
    }),

    getWeatherForLocation: tool({
      description: 'Get current weather information a specific location.',
      parameters: z.object({
        location: z
          .string()
          .describe(
            'Location to get weather for (city, state, coordinates, or trail name)'
          ),
      }),
      execute: async ({ location }) => {
        try {
          const weatherData =
            await weatherService.getWeatherForLocation(location);
          return {
            success: true,
            ...weatherData,
          };
        } catch (error) {
          sentry.setTag('location', 'ai-tool-call/getWeatherForLocation');
          sentry.setContext('meta', { location });
          sentry.captureException(error);
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to get weather data',
          };
        }
      },
    }),

    getCatalogItems: tool({
      description:
        'Retrieve items from the comprehensive gear database with optional filters or search criteria.',
      parameters: z.object({
        query: z
          .string()
          .optional()
          .describe('Optional search query to filter catalog items'),
        category: z
          .string()
          .optional()
          .describe('Optional category to filter catalog items'),
        limit: z
          .number()
          .min(1)
          .max(100)
          .optional()
          .describe('Optional limit for number of results to return'),
        offset: z
          .number()
          .min(0)
          .optional()
          .describe('Optional offset for pagination of results'),
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
          sentry.setTag('location', 'ai-tool-call/getCatalogItems');
          sentry.setContext('meta', { query, category, limit, offset });
          sentry.captureException(error);
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to retrieve catalog items',
          };
        }
      },
    }),

    semanticCatalogSearch: tool({
      description:
        'Search the comprehensive gear database using semantic search.',
      parameters: z.object({
        query: z.string().min(1).describe('Search query to find catalog items'),
        limit: z
          .number()
          .min(1)
          .max(100)
          .optional()
          .describe('Optional limit for number of results to return'),
        offset: z
          .number()
          .min(0)
          .optional()
          .describe('Optional offset for pagination of results'),
      }),
      execute: async ({ query, limit, offset }) => {
        try {
          const items = await catalogService.semanticSearch(
            query,
            limit || 10,
            offset || 0
          );
          return {
            success: true,
            items,
          };
        } catch (error) {
          sentry.setTag('location', 'ai-tool-call/semanticCatalogSearch');
          sentry.setContext('meta', { query });
          sentry.captureException(error);
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to perform semantic search',
          };
        }
      },
    }),
  };
}
