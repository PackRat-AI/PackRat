import { z } from 'zod';
import { call } from '../client';
import { CatalogSimilarityOutputSchema, GetCatalogItemOutputSchema } from '../output-schemas';
import { tool } from '../registerTool';
import type { AgentContext } from '../types';

export function registerCatalogTools(agent: AgentContext): void {
  // ── Text search ─────────────────────────────────────────────────────────
  // DISABLED — keyword catalog search is not shipped on the connector surface.
  //
  // The matcher treats the ENTIRE query string as one literal phrase (see the
  // `wordBoundary` regex in CatalogService.getCatalogItems), so it has no
  // tokenisation: `"2 person tent"` returns 111 hits while
  // `"ultralight 2-person tent under 1.5 kg"` and `"FreeLite 2 Person"` both
  // return 0 — even though the catalog holds 7 FreeLite tents. During an
  // OpenAI Apps review run the model read those empty results as "PackRat has
  // no such gear" and offered to search the web instead, which is the worst
  // outcome an app review can produce.
  //
  // `packrat_semantic_gear_search` (vector) handles the same natural-language
  // queries correctly — it returned 30 relevant hits on the identical prompt —
  // so the keyword path is withdrawn rather than shipped alongside it. Re-enable
  // once the matcher tokenises the query and ranks per-token instead of
  // requiring a contiguous phrase match.
  //
  // tool<{
  //   query?: string;
  //   category?: string;
  //   limit: number;
  //   page: number;
  //   sort_by?: CatalogSortField;
  //   sort_order: SortOrder;
  // }>(
  //   agent.server,
  //   'packrat_search_gear_catalog',
  //   {
  //     title: 'Search Gear Catalog',
  //     description:
  //       `Search the PackRat gear catalog of outdoor products with specs, weights, prices, and user reviews. Use this to find specific gear, compare products, or browse categories. ` +
  //       `Paginated via \`page\` (1-indexed); page size is capped at ${PAGINATION_LIMIT_MAX} server-side.`,
  //     inputSchema: {
  //       query: z
  //         .string()
  //         .optional()
  //         .describe('Search keywords (e.g. "ultralight sleeping bag 20°F")'),
  //       category: z
  //         .string()
  //         .optional()
  //         .describe(
  //           'Filter by category (e.g. "sleeping bags", "tents", "backpacks", "footwear", "apparel")',
  //         ),
  //       limit: z
  //         .number()
  //         .int()
  //         .min(1)
  //         .max(50)
  //         .default(10)
  //         .describe(`Page size (clamped to ${PAGINATION_LIMIT_MAX} server-side).`),
  //       page: z.number().int().min(1).default(1),
  //       sort_by: z.nativeEnum(CatalogSortField).optional(),
  //       sort_order: z.nativeEnum(SortOrder).default(SortOrder.Asc),
  //     },
  //     outputSchema: SearchGearCatalogOutputSchema.shape,
  //     annotations: {
  //       title: 'Search Gear Catalog',
  //       readOnlyHint: true,
  //       destructiveHint: false,
  //       idempotentHint: true,
  //       openWorldHint: false,
  //     },
  //   },
  //   async ({ query, category, limit, page, sort_by, sort_order }) =>
  //     call({
  //       promise: agent.api.user.catalog.get({
  //         query: {
  //           q: query,
  //           category,
  //           limit: clampLimit({ value: limit }),
  //           page,
  //           sort: sort_by ? { field: sort_by, order: sort_order } : undefined,
  //         },
  //       }),
  //       action: 'search catalog',
  //       structured: true,
  //     }),
  // );

  // ── Semantic/vector search ────────────────────────────────────────────────

  tool<{ query: string; limit: number }>(
    agent.server,
    'packrat_semantic_gear_search',
    {
      title: 'Semantic Gear Search',
      description:
        'Search the gear catalog using vector/semantic search. Good for natural-language queries like "warm but lightweight insulation layer for cold shoulder-season camping" or "minimalist trail running shoe for rocky terrain".',
      inputSchema: {
        query: z.string().min(3),
        limit: z.number().int().min(1).max(30).default(8),
      },
      outputSchema: CatalogSimilarityOutputSchema.shape,
      annotations: {
        title: 'Semantic Gear Search',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ query, limit }) =>
      call({
        promise: agent.api.user.catalog['vector-search'].get({ query: { q: query, limit } }),
        action: 'semantic catalog search',
        structured: true,
      }),
  );

  // ── Get single item ───────────────────────────────────────────────────────

  tool<{ item_id: number }>(
    agent.server,
    'packrat_get_catalog_item',
    {
      title: 'Get Catalog Item',
      description:
        'Retrieve full details for a specific gear catalog item by ID. Returns specs, dimensions, weight, price, availability, user reviews, Q&A, and product URL.',
      inputSchema: {
        item_id: z.number().int().describe('The catalog item ID'),
      },
      outputSchema: GetCatalogItemOutputSchema.shape,
      annotations: {
        title: 'Get Catalog Item',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ item_id }) =>
      call({
        promise: agent.api.user.catalog({ id: String(item_id) }).get(),
        action: 'get catalog item',
        resourceHint: `catalog item ${item_id}`,
        structured: true,
      }),
  );

  // ── Similar catalog items ─────────────────────────────────────────────────

  tool<{ item_id: number; limit: number; threshold?: number }>(
    agent.server,
    'packrat_similar_catalog_items',
    {
      title: 'Find Similar Catalog Items',
      description: 'Find items similar to a given catalog item by embedding similarity.',
      inputSchema: {
        item_id: z.number().int(),
        limit: z.number().int().min(1).max(50).default(10),
        threshold: z.number().min(0).max(1).optional(),
      },
      outputSchema: CatalogSimilarityOutputSchema.shape,
      annotations: {
        title: 'Find Similar Catalog Items',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ item_id, limit, threshold }) =>
      call({
        promise: agent.api.user.catalog({ id: String(item_id) }).similar.get({
          query: {
            limit: String(limit),
            ...(threshold !== undefined ? { threshold: String(threshold) } : {}),
          },
        }),
        action: 'find similar catalog items',
        resourceHint: `catalog item ${item_id}`,
        structured: true,
      }),
  );

  // ── List categories ───────────────────────────────────────────────────────

  tool<{ limit?: number }>(
    agent.server,
    'packrat_list_gear_categories',
    {
      title: 'List Gear Categories',
      description:
        'List all available gear categories in the catalog with item counts. Use this to explore what gear types are available before searching.',
      inputSchema: { limit: z.number().int().min(1).max(200).optional() },
      annotations: {
        title: 'List Gear Categories',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ limit }) =>
      call({
        promise: agent.api.user.catalog.categories.get({ query: { limit } }),
        action: 'list catalog categories',
      }),
  );

  // ── Create a catalog item (user-submitted) — DISABLED ─────────────────────
  // Intentionally not shipped: end users should not be minting new catalog
  // rows via the connector. Re-enable if user-submitted catalog entries
  // become a supported flow.
  //
  // tool<{
  //   name: string;
  //   description?: string;
  //   brand?: string;
  //   model?: string;
  //   weight: number;
  //   weight_unit: 'g' | 'oz' | 'kg' | 'lb';
  //   sku: string;
  //   categories?: string[];
  //   images?: string[];
  //   rating?: number;
  //   product_url: string;
  // }>(
  //   agent.server,
  //   'packrat_create_catalog_item',
  //   {
  //     title: 'Create Catalog Item',
  //     description:
  //       'Submit a new gear item to the catalog. The API will embed and dedupe automatically. Use this for custom items not yet in the catalog.',
  //     inputSchema: {
  //       name: z.string().min(1),
  //       description: z.string().optional(),
  //       brand: z.string().optional(),
  //       model: z.string().optional(),
  //       weight: z.number().positive(),
  //       weight_unit: z.enum(['g', 'oz', 'kg', 'lb']),
  //       sku: z.string().describe('Stock-keeping unit / product identifier'),
  //       categories: z.array(z.string()).optional(),
  //       images: z.array(z.string()).optional(),
  //       rating: z.number().min(0).max(5).optional(),
  //       product_url: z.string().url(),
  //     },
  //     annotations: {
  //       title: 'Create Catalog Item',
  //       readOnlyHint: false,
  //       destructiveHint: false,
  //       idempotentHint: false,
  //       openWorldHint: false,
  //     },
  //   },
  //   async ({
  //     name,
  //     description,
  //     brand,
  //     model,
  //     weight,
  //     weight_unit,
  //     sku,
  //     categories,
  //     images,
  //     rating,
  //     product_url,
  //   }) =>
  //     call({
  //       promise: agent.api.user.catalog.post({
  //         name,
  //         description,
  //         brand,
  //         model,
  //         weight,
  //         weightUnit: weight_unit,
  //         sku,
  //         categories,
  //         images,
  //         ratingValue: rating,
  //         productUrl: product_url,
  //       }),
  //       action: 'create catalog item',
  //     }),
  // );

  // ── Compare items (API-side path proposed; until then, multi-fetch) ───────
  // NOTE: this duplicates work the API could do in a single `/catalog/compare`
  // endpoint that accepts an `ids[]` query. Tracked in the API thickening list.

  // DISABLED — gear comparison is not shipped on the connector surface.
  //
  // The tool takes `item_ids`, which the model can only obtain from a prior
  // catalog search. Across three OpenAI Apps review runs of the gear-comparison
  // test case it was never invoked once: the model formatted its own markdown
  // table from search results instead of round-tripping IDs through another
  // call. Declaring a tool that never fires is a submission-review liability,
  // so it is withdrawn until the comparison path is something the model
  // actually reaches for.
  //
  // tool<{ item_ids: number[] }>(
  //   agent.server,
  //   'packrat_compare_gear_items',
  //   {
  //     title: 'Compare Gear Items',
  //     description:
  //       'Compare multiple gear items side-by-side on weight, price, and rating. Provide 2–10 catalog item IDs.',
  //     inputSchema: {
  //       item_ids: z.array(z.number().int()).min(2).max(10),
  //     },
  //     annotations: {
  //       title: 'Compare Gear Items',
  //       readOnlyHint: true,
  //       destructiveHint: false,
  //       idempotentHint: true,
  //       openWorldHint: false,
  //     },
  //   },
  //   async ({ item_ids }) =>
  //     call({
  //       promise: agent.api.user.catalog.compare.post({ ids: item_ids }),
  //       action: 'compare catalog items',
  //     }),
  // );
}
