/**
 * Tools for the local on-device AI model (Apple Foundation Models / Llama).
 *
 * These tools operate on:
 *  - Local Legend-State stores (packs, packItems) for data already on device
 *  - The API via the typed `apiClient` for data that requires a network call
 *
 * All tools mirror the server-side tools in packages/api/src/utils/ai/tools.ts.
 * Network-dependent tools (vectorSearch, RAG, webSearch, executeSql) proxy
 * through authenticated API endpoints.
 */

import { tool } from 'ai';
import { getPackItems, packItemsStore } from 'expo-app/features/packs/store/packItems';
import { packsStore } from 'expo-app/features/packs/store/packs';
import { getWeatherData, searchLocations } from 'expo-app/features/weather/lib/weatherService';
import { apiClient } from 'expo-app/lib/api/packrat';
import { z } from 'zod';

export function createLocalTools() {
  return {
    getPackDetails: tool({
      description:
        'Get detailed information about a specific pack including all its items, weights, and categories. Use this when the user asks about a specific pack by name or ID.',
      inputSchema: z.object({
        packId: z
          .string()
          .optional()
          .describe('The ID of the pack to get details for. If omitted, lists all packs.'),
      }),
      execute: async ({ packId }) => {
        try {
          const allPacks = packsStore.get();

          if (packId) {
            const pack = allPacks[packId];
            if (!pack || pack.deleted) {
              return { success: false, error: 'Pack not found' };
            }
            const items = getPackItems(packId);
            const categories = Array.from(
              new Set(items.map((item) => item.category || 'Uncategorized')),
            );
            return {
              success: true,
              data: { ...pack, items, categories },
            };
          }

          const packs = Object.values(allPacks).filter((p) => !p.deleted);
          return {
            success: true,
            data: packs.map((p) => ({
              id: p.id,
              name: p.name,
              description: p.description,
              category: p.category,
              isPublic: p.isPublic,
              tags: p.tags,
            })),
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get pack details',
          };
        }
      },
    }),

    getPackItemDetails: tool({
      description:
        'Get detailed information about a specific item in a pack, including weight, category, quantity and notes.',
      inputSchema: z.object({
        itemId: z.string().describe('The ID of the pack item to get details for'),
      }),
      execute: async ({ itemId }) => {
        try {
          const item = packItemsStore.get()[itemId];
          if (!item || item.deleted) {
            return { success: false, error: 'Item not found' };
          }
          return { success: true, data: item };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get item details',
          };
        }
      },
    }),

    getWeatherForLocation: tool({
      description:
        'Get current weather information for a specific location. Use this when the user asks about weather for a city, trail, or coordinates.',
      inputSchema: z.object({
        location: z
          .string()
          .describe('Location to get weather for (city name, state, trail name, etc.)'),
      }),
      execute: async ({ location }) => {
        try {
          const results = await searchLocations(location);
          if (!results.length) {
            return { success: false, error: `No location found for "${location}"` };
          }
          const first = results[0];
          if (!first) {
            return { success: false, error: `No location found for "${location}"` };
          }
          const weatherData = await getWeatherData(first.id);
          return { success: true, data: weatherData };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get weather data',
          };
        }
      },
    }),

    getCatalogItems: tool({
      description:
        'Retrieve outdoor gear items from the PackRat catalog database with optional filters. Use this when the user asks about gear recommendations or wants to browse catalog items.',
      inputSchema: z.object({
        query: z.string().optional().describe('Optional search query to filter catalog items'),
        category: z.string().optional().describe('Optional category to filter catalog items'),
        limit: z
          .number()
          .min(1)
          .max(50)
          .optional()
          .describe('Number of results to return (default 10)'),
        offset: z.number().min(0).optional().describe('Offset for pagination'),
      }),
      execute: async ({ query, category, limit = 10, offset: _offset = 0 }) => {
        const { data, error } = await apiClient.catalog.get({
          query: {
            page: 1,
            limit,
            ...(query ? { q: query } : {}),
            ...(category ? { category } : {}),
          },
        });
        if (error) {
          return { success: false, error: error.value ?? 'Failed to retrieve catalog items' };
        }
        return { success: true, data };
      },
    }),

    catalogVectorSearch: tool({
      description:
        'Search the comprehensive gear database using vector/semantic similarity. Prefer this over getCatalogItems when the user describes gear in natural language rather than exact keywords.',
      inputSchema: z.object({
        query: z.string().min(1).describe('Natural language search query to find catalog items'),
        limit: z
          .number()
          .min(1)
          .max(100)
          .optional()
          .describe('Number of results to return (default 10)'),
        offset: z.number().min(0).optional().describe('Offset for pagination'),
      }),
      execute: async ({ query, limit = 10, offset = 0 }) => {
        const { data, error } = await apiClient.catalog['vector-search'].get({
          query: { q: query, limit, offset },
        });
        if (error) {
          return { success: false, error: error.value ?? 'Failed to perform vector search' };
        }
        return { success: true, data };
      },
    }),

    searchPackratOutdoorGuidesRAG: tool({
      description:
        'Search the PackRat outdoor guides knowledge base using RAG (Retrieval-Augmented Generation). Use this when the user asks about hiking tips, gear advice, or outdoor techniques.',
      inputSchema: z.object({
        query: z.string().min(1).describe('Search query for outdoor guides'),
        limit: z
          .number()
          .min(1)
          .max(100)
          .optional()
          .describe('Number of results to return (default 5)'),
      }),
      execute: async ({ query, limit = 5 }) => {
        const { data, error } = await apiClient.ai['rag-search'].get({
          query: { q: query, limit },
        });
        if (error) {
          return { success: false, error: error.value ?? 'Failed to search outdoor guides' };
        }
        return { success: true, data };
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
        const { data, error } = await apiClient.ai['web-search'].get({
          query: { q: query },
        });
        if (error) {
          return { success: false, error: error.value ?? 'Search failed' };
        }
        return { success: true, data };
      },
    }),

    executeSql: tool({
      description:
        'Execute read-only SQL queries against the database. Only SELECT statements are allowed. Call getDatabaseSchema first if you need to know the available tables and columns.',
      inputSchema: z.object({
        query: z
          .string()
          .describe('SQL SELECT statement to execute. Must be a valid SELECT query.'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(1000)
          .optional()
          .describe('Maximum number of rows to return (default: 100, max: 1000)'),
      }),
      execute: async ({ query, limit = 100 }) => {
        const { data, error } = await apiClient.ai['execute-sql'].post({ query, limit });
        if (error) {
          return { success: false, error: error.value ?? 'Failed to execute query' };
        }
        return data;
      },
    }),

    getDatabaseSchema: tool({
      description:
        'Retrieve the database schema (table names and columns). Call this before executeSql if you are unsure which tables or columns exist.',
      inputSchema: z.object({}),
      execute: async () => {
        const { data, error } = await apiClient.ai['db-schema'].get();
        if (error) {
          return { success: false, error: error.value ?? 'Failed to retrieve database schema' };
        }
        return { success: true, data };
      },
    }),
  };
}

export type LocalTools = ReturnType<typeof createLocalTools>;
