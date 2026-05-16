import { z } from 'zod';
import { call } from '../client';
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
        limit: z.number().int().min(1).max(50).default(10),
        page: z.number().int().min(1).default(1),
        sort_by: z.nativeEnum(CatalogSortField).optional(),
        sort_order: z.nativeEnum(SortOrder).default(SortOrder.Asc),
      },
    },
    async ({ query, category, limit, page, sort_by, sort_order }) =>
      call(
        agent.api.user.catalog.get({
          query: {
            q: query,
            category,
            limit,
            page,
            sort: sort_by ? { field: sort_by, order: sort_order } : undefined,
          },
        }),
        { action: 'search catalog' },
      ),
  );

  // ── Semantic/vector search ────────────────────────────────────────────────

  agent.server.registerTool(
    'semantic_gear_search',
    {
      description:
        'Search the gear catalog using AI-powered semantic/vector search. Great for natural-language queries like "warm but lightweight insulation layer for cold shoulder-season camping" or "minimalist trail running shoe for rocky terrain".',
      inputSchema: {
        query: z.string().min(3),
        limit: z.number().int().min(1).max(30).default(8),
      },
    },
    async ({ query, limit }) =>
      call(agent.api.user.catalog['vector-search'].get({ query: { q: query, limit } }), {
        action: 'semantic catalog search',
      }),
  );

  // ── Get single item ───────────────────────────────────────────────────────

  agent.server.registerTool(
    'get_catalog_item',
    {
      description:
        'Retrieve full details for a specific gear catalog item by ID. Returns all specs, dimensions, weight, price, availability, user reviews, Q&A, and product URL.',
      inputSchema: {
        item_id: z.number().int().describe('The catalog item ID'),
      },
    },
    async ({ item_id }) =>
      call(agent.api.user.catalog({ id: String(item_id) }).get(), {
        action: 'get catalog item',
        resourceHint: `catalog item ${item_id}`,
      }),
  );

  // ── Similar catalog items ─────────────────────────────────────────────────

  agent.server.registerTool(
    'similar_catalog_items',
    {
      description: 'Find items similar to a given catalog item by embedding similarity.',
      inputSchema: {
        item_id: z.number().int(),
        limit: z.number().int().min(1).max(50).default(10),
        threshold: z.number().min(0).max(1).optional(),
      },
    },
    async ({ item_id, limit, threshold }) =>
      call(
        agent.api.user.catalog({ id: String(item_id) }).similar.get({
          query: { limit, ...(threshold !== undefined ? { threshold } : {}) },
        }),
        { action: 'find similar catalog items', resourceHint: `catalog item ${item_id}` },
      ),
  );

  // ── List categories ───────────────────────────────────────────────────────

  agent.server.registerTool(
    'list_gear_categories',
    {
      description:
        'List all available gear categories in the catalog with item counts. Use this to explore what gear types are available before searching.',
      inputSchema: { limit: z.number().int().min(1).max(200).optional() },
    },
    async ({ limit }) =>
      call(agent.api.user.catalog.categories.get({ query: { limit } }), {
        action: 'list catalog categories',
      }),
  );

  // ── Create a catalog item (user-submitted) ────────────────────────────────

  agent.server.registerTool(
    'create_catalog_item',
    {
      description:
        'Submit a new gear item to the catalog. The API will embed and dedupe automatically. Use this for custom items not yet in the catalog.',
      inputSchema: {
        name: z.string().min(1),
        description: z.string().optional(),
        brand: z.string().optional(),
        model: z.string().optional(),
        weight: z.number().min(0).optional(),
        weight_unit: z.enum(['g', 'oz', 'kg', 'lb']).optional(),
        categories: z.array(z.string()).optional(),
        images: z.array(z.string()).optional(),
        rating: z.number().min(0).max(5).optional(),
        product_url: z.string().url().optional(),
      },
    },
    async ({
      name,
      description,
      brand,
      model,
      weight,
      weight_unit,
      categories,
      images,
      rating,
      product_url,
    }) =>
      call(
        agent.api.user.catalog.post({
          name,
          description,
          brand,
          model,
          weight,
          weightUnit: weight_unit,
          categories,
          images,
          rating,
          productUrl: product_url,
        }),
        { action: 'create catalog item' },
      ),
  );

  // ── Compare items (API-side path proposed; until then, multi-fetch) ───────
  // NOTE: this duplicates work the API could do in a single `/catalog/compare`
  // endpoint that accepts an `ids[]` query. Tracked in the API thickening list.

  agent.server.registerTool(
    'compare_gear_items',
    {
      description:
        'Compare multiple gear items side-by-side on weight, price, and rating. Provide 2–5 catalog item IDs.',
      inputSchema: {
        item_ids: z.array(z.number().int()).min(2).max(5),
      },
    },
    async ({ item_ids }) => {
      const responses = await Promise.all(
        item_ids.map((id) => agent.api.user.catalog({ id: String(id) }).get()),
      );
      const firstError = responses.find((r) => r.error || !r.data);
      if (firstError) {
        return call(
          Promise.resolve({
            data: null,
            error: firstError.error,
            status: firstError.status,
          }),
          { action: 'compare catalog items' },
        );
      }
      const comparison = responses.map((r) => {
        // safe-cast: catalog item response is a JSON object; display only
        const it = (r.data ?? {}) as Record<string, unknown>;
        return {
          id: it.id,
          name: it.name,
          brand: it.brand,
          category: it.category,
          weightGrams: it.weight,
          priceCents: it.price,
          rating: it.ratingValue,
          reviewCount: it.ratingCount,
          productUrl: it.productUrl,
        };
      });
      comparison.sort(
        (a, b) => (Number(a.weightGrams) || 999_999) - (Number(b.weightGrams) || 999_999),
      );
      return call(
        Promise.resolve({
          data: {
            items: comparison,
            lightest: comparison[0]?.name,
            cheapest: [...comparison].sort(
              (a, b) => (Number(a.priceCents) || 999_999) - (Number(b.priceCents) || 999_999),
            )[0]?.name,
            highestRated: [...comparison].sort(
              (a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0),
            )[0]?.name,
          },
          error: null,
          status: 200,
        }),
        { action: 'compare catalog items' },
      );
    },
  );
}
