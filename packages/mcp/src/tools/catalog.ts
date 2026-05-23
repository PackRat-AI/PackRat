import { z } from 'zod';
import { call } from '../client';
import { CatalogSortField, SortOrder } from '../enums';
import type { AgentContext } from '../types';

export function registerCatalogTools(agent: AgentContext): void {
  // ── Text search ───────────────────────────────────────────────────────────

  agent.server.registerTool(
    'packrat_search_gear_catalog',
    {
      title: 'Search Gear Catalog',
      description:
        'Search the PackRat gear catalog of outdoor products with specs, weights, prices, and user reviews. Use this to find specific gear, compare products, or browse categories.',
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
      annotations: {
        title: 'Search Gear Catalog',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
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
    'packrat_semantic_gear_search',
    {
      title: 'Semantic Gear Search',
      description:
        'Search the gear catalog using vector/semantic search. Good for natural-language queries like "warm but lightweight insulation layer for cold shoulder-season camping" or "minimalist trail running shoe for rocky terrain".',
      inputSchema: {
        query: z.string().min(3),
        limit: z.number().int().min(1).max(30).default(8),
      },
      annotations: {
        title: 'Semantic Gear Search',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ query, limit }) =>
      call(agent.api.user.catalog['vector-search'].get({ query: { q: query, limit } }), {
        action: 'semantic catalog search',
      }),
  );

  // ── Get single item ───────────────────────────────────────────────────────

  agent.server.registerTool(
    'packrat_get_catalog_item',
    {
      title: 'Get Catalog Item',
      description:
        'Retrieve full details for a specific gear catalog item by ID. Returns specs, dimensions, weight, price, availability, user reviews, Q&A, and product URL.',
      inputSchema: {
        item_id: z.number().int().describe('The catalog item ID'),
      },
      annotations: {
        title: 'Get Catalog Item',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
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
    'packrat_similar_catalog_items',
    {
      title: 'Find Similar Catalog Items',
      description: 'Find items similar to a given catalog item by embedding similarity.',
      inputSchema: {
        item_id: z.number().int(),
        limit: z.number().int().min(1).max(50).default(10),
        threshold: z.number().min(0).max(1).optional(),
      },
      annotations: {
        title: 'Find Similar Catalog Items',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
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
    'packrat_list_gear_categories',
    {
      title: 'List Gear Categories',
      description:
        'List all available gear categories in the catalog with item counts. Use this to explore what gear types are available before searching.',
      inputSchema: { limit: z.number().int().min(1).max(200).optional() },
      annotations: {
        title: 'List Gear Categories',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ limit }) =>
      call(agent.api.user.catalog.categories.get({ query: { limit } }), {
        action: 'list catalog categories',
      }),
  );

  // ── Create a catalog item (user-submitted) ────────────────────────────────

  agent.server.registerTool(
    'packrat_create_catalog_item',
    {
      title: 'Create Catalog Item',
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
      annotations: {
        title: 'Create Catalog Item',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
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
    'packrat_compare_gear_items',
    {
      title: 'Compare Gear Items',
      description:
        'Compare multiple gear items side-by-side on weight, price, and rating. Provide 2–10 catalog item IDs.',
      inputSchema: {
        item_ids: z.array(z.number().int()).min(2).max(10),
      },
      annotations: {
        title: 'Compare Gear Items',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ item_ids }) =>
      call(agent.api.user.catalog.compare.post({ ids: item_ids }), {
        action: 'compare catalog items',
      }),
  );
}
