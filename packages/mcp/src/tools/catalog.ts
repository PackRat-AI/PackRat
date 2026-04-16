import { z } from 'zod';
import { err, ok } from '../client';
import { CatalogSortField, SortOrder } from '../enums';
import type { AgentContext } from '../types';

export function registerCatalogTools(agent: AgentContext): void {
  // ── Text search ───────────────────────────────────────────────────────────

  agent.server.registerTool(
    'search_gear_catalog',
    {
      description:
        'Search the PackRat gear catalog containing thousands of real outdoor products with specs, weights, prices, and user reviews. Use this to find specific gear, compare products, or browse categories.',
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe('Search keywords (e.g. "ultralight sleeping bag 20°F")'),
        category: z
          .string()
          .optional()
          .describe(
            'Filter by category (e.g. "sleeping bags", "tents", "backpacks", "footwear", "apparel")',
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(10)
          .describe('Number of results to return (default 10)'),
        page: z.number().int().min(1).default(1).describe('Page number (default 1)'),
        sort_by: z.nativeEnum(CatalogSortField).optional().describe('Sort field'),
        sort_order: z.nativeEnum(SortOrder).default(SortOrder.Asc).describe('Sort direction'),
      },
    },
    async ({ query, category, limit, page, sort_by, sort_order }) => {
      try {
        const data = await agent.api.get('/catalog', {
          q: query,
          category,
          limit,
          page,
          'sort[field]': sort_by,
          'sort[order]': sort_order,
        });
        return ok(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── Semantic/vector search ────────────────────────────────────────────────

  agent.server.registerTool(
    'semantic_gear_search',
    {
      description:
        'Search the gear catalog using AI-powered semantic/vector search. Unlike keyword search, this understands context and meaning — great for queries like "warm but lightweight insulation layer for cold shoulder-season camping" or "minimalist trail running shoe for rocky terrain".',
      inputSchema: {
        query: z
          .string()
          .min(3)
          .describe(
            'Natural language description of the gear you need. Be specific about use-case, conditions, weight preferences, or features.',
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(30)
          .default(8)
          .describe('Number of results to return (default 8)'),
      },
    },
    async ({ query, limit }) => {
      try {
        const data = await agent.api.get('/catalog/vector-search', { q: query, limit });
        return ok(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── Get single item ───────────────────────────────────────────────────────

  agent.server.registerTool(
    'get_catalog_item',
    {
      description:
        'Retrieve full details for a specific gear catalog item by ID. Returns all specs, dimensions, weight, price, availability, user reviews, Q&A, and product URL.',
      inputSchema: {
        item_id: z
          .number()
          .int()
          .describe('The catalog item ID (from search_gear_catalog or semantic_gear_search)'),
      },
    },
    async ({ item_id }) => {
      try {
        const data = await agent.api.get(`/catalog/${item_id}`);
        return ok(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── List categories ───────────────────────────────────────────────────────

  agent.server.registerTool(
    'list_gear_categories',
    {
      description:
        'List all available gear categories in the catalog with item counts. Use this to explore what gear types are available before searching.',
      inputSchema: {},
    },
    async () => {
      try {
        const data = await agent.api.get('/catalog/categories');
        return ok(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── Compare items ─────────────────────────────────────────────────────────

  agent.server.registerTool(
    'compare_gear_items',
    {
      description:
        'Compare multiple gear items side-by-side on key attributes: weight, price, rating, and specs. Returns a structured comparison table. Provide 2–5 item IDs.',
      inputSchema: {
        item_ids: z
          .array(z.number().int())
          .min(2)
          .max(5)
          .describe('Array of 2–5 catalog item IDs to compare'),
      },
    },
    async ({ item_ids }) => {
      try {
        const items = await Promise.all(
          item_ids.map((id) => agent.api.get<Record<string, unknown>>(`/catalog/${id}`)),
        );
        const comparison = items.map((it) => ({
          id: it.id,
          name: it.name,
          brand: it.brand,
          category: it.category,
          weightGrams: it.weight,
          priceCents: it.price,
          rating: it.ratingValue,
          reviewCount: it.ratingCount,
          productUrl: it.productUrl,
        }));

        comparison.sort(
          (a, b) => (Number(a.weightGrams) || 999999) - (Number(b.weightGrams) || 999999),
        );

        return ok({
          items: comparison,
          lightest: comparison[0]?.name,
          cheapest: [...comparison].sort(
            (a, b) => (Number(a.priceCents) || 999999) - (Number(b.priceCents) || 999999),
          )[0]?.name,
          highestRated: [...comparison].sort(
            (a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0),
          )[0]?.name,
        });
      } catch (e) {
        return err(e);
      }
    },
  );
}
