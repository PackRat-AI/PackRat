import { z } from 'zod';
import { call, clampLimit, nowIso, ok, PAGINATION_LIMIT_MAX, withNextOffset } from '../client';
import { ItemCategory, PackCategory } from '../enums';
import {
  GetPackItemOutputSchema,
  GetPackOutputSchema,
  ListPackItemsOutputSchema,
  ListPacksOutputSchema,
} from '../output-schemas';
import { tool } from '../registerTool';
import type { AgentContext } from '../types';

export function registerPackTools(agent: AgentContext): void {
  // ── List packs ────────────────────────────────────────────────────────────

  tool<{ include_public: boolean; limit?: number; offset: number }>(
    agent.server,
    'packrat_list_packs',
    {
      title: 'List My Packs',
      description:
        `List all packs belonging to the authenticated user. Returns pack summaries including name, category, item count, and total weight. ` +
        `Paginated: results are capped at ${PAGINATION_LIMIT_MAX} items per call; the response includes a \`nextOffset\` value (or \`null\` at the end) to continue iterating.`,
      inputSchema: {
        include_public: z
          .boolean()
          .default(false)
          .describe('Include public packs from other users'),
        limit: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe(`Page size (clamped to ${PAGINATION_LIMIT_MAX} server-side).`),
        offset: z
          .number()
          .int()
          .min(0)
          .default(0)
          .describe('Pagination offset; use `nextOffset` from the previous response.'),
      },
      // U8: tier-1 structured output. The MCP-side envelope is
      // `{ data: Pack[], nextOffset }` — the API returns a bare array;
      // the wrapper here normalises it.
      outputSchema: ListPacksOutputSchema.shape,
      annotations: {
        title: 'List My Packs',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ include_public, limit, offset }) => {
      const clamped = clampLimit({ value: limit });
      const result = await agent.api.user.packs.get({
        query: { includePublic: include_public ? 1 : 0 },
      });
      if (result.error || result.data == null) {
        // Defer to the standard error envelope for failure consistency.
        return call({ promise: Promise.resolve(result), action: 'list packs' });
      }
      const items = Array.isArray(result.data) ? result.data : [];
      // U8 server-side pagination: the API doesn't slice today, so we
      // slice here using the clamped limit + offset. This keeps the
      // structured envelope honest about page size and `nextOffset`.
      const page = items.slice(offset, offset + clamped);
      // Drop each pack's `items` array from the listing.
      //
      // WHY: `GET /api/packs` inlines every pack's full item list, and the
      // route takes no limit — it returns the account's entire pack history.
      // On an account with a dozen packs that is ~10 KB per pack, and the
      // pretty-printed envelope blew past the 150k response cap (measured at
      // 174 343 chars on the review account). Truncation drops
      // `structuredContent`, so the model receives an unparseable blob and
      // reports it cannot read the user's packs at all — which is exactly
      // what happened on two of three runs of the submission test case.
      //
      // Slicing alone does not fix it: the oversized payload has already
      // crossed the wire and been parsed before the slice happens. A listing
      // does not need per-item detail anyway — `totalWeight`/`baseWeight` are
      // already computed server-side, and `packrat_get_pack` /
      // `packrat_list_pack_items` exist for drilling into one pack.
      //
      // `items` is optional on PackSchema, so omitting it stays schema-valid.
      const summaries = page.map((pack) => {
        const { items: _items, ...rest } = pack as typeof pack & { items?: unknown };
        return rest;
      });
      return ok({
        data: withNextOffset({ items: summaries, offset, limit: clamped }),
        structured: true,
      });
    },
  );

  // ── Get pack details ──────────────────────────────────────────────────────

  tool<{ pack_id: string }>(
    agent.server,
    'packrat_get_pack',
    {
      title: 'Get Pack',
      description:
        'Get complete details of a single pack including all items with weights, categories, and computed totals. Use this to analyze pack weight, find gear gaps, or suggest optimizations.',
      inputSchema: {
        pack_id: z.string().describe('The unique pack ID (e.g. "p_abc123")'),
      },
      // U8: tier-1 structured output — full Pack-with-items shape.
      outputSchema: GetPackOutputSchema.shape,
      annotations: {
        title: 'Get Pack',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ pack_id }) =>
      call({
        promise: agent.api.user.packs({ packId: pack_id }).get(),
        action: 'get pack',
        resourceHint: `pack ${pack_id}`,
        structured: true,
      }),
  );

  // ── Create pack ───────────────────────────────────────────────────────────

  tool<{
    name: string;
    description?: string;
    category: PackCategory;
    is_public: boolean;
    tags?: string[];
  }>(
    agent.server,
    'packrat_create_pack',
    {
      title: 'Create Pack',
      description:
        'Create a new packing list for the user. Returns the newly created pack with its ID.',
      inputSchema: {
        name: z.string().min(1).describe('Pack name (e.g. "3-Day Yosemite Trip")'),
        description: z.string().optional().describe('Optional longer description of the pack'),
        category: z.nativeEnum(PackCategory).describe('Pack category'),
        is_public: z
          .boolean()
          .default(false)
          .describe('Whether this pack is publicly discoverable by other users'),
        tags: z.array(z.string()).optional().describe('Optional tags for the pack'),
      },
      annotations: {
        title: 'Create Pack',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ name, description, category, is_public, tags }) => {
      const now = nowIso();
      return call({
        promise: agent.api.user.packs.post({
          id: crypto.randomUUID(),
          name,
          description,
          category,
          isPublic: is_public,
          tags,
          localCreatedAt: now,
          localUpdatedAt: now,
        }),
        action: 'create pack',
      });
    },
  );

  // ── Update pack ───────────────────────────────────────────────────────────

  tool<{
    pack_id: string;
    name?: string;
    description?: string | null;
    category?: PackCategory;
    is_public?: boolean;
    tags?: string[];
  }>(
    agent.server,
    'packrat_update_pack',
    {
      title: 'Update Pack',
      description: "Update a pack's name, description, category, visibility, or tags.",
      inputSchema: {
        pack_id: z.string().describe('The unique pack ID to update'),
        name: z.string().min(1).optional().describe('New pack name'),
        description: z.string().optional().nullable().describe('New description'),
        category: z.nativeEnum(PackCategory).optional().describe('New category'),
        is_public: z.boolean().optional().describe('Update public visibility'),
        tags: z.array(z.string()).optional().describe('New tags (replaces existing tags)'),
      },
      annotations: {
        title: 'Update Pack',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ pack_id, name, description, category, is_public, tags }) => {
      const body: Record<string, unknown> = { localUpdatedAt: nowIso() };
      if (name !== undefined) body.name = name;
      if (description !== undefined) body.description = description;
      if (category !== undefined) body.category = category;
      if (is_public !== undefined) body.isPublic = is_public;
      if (tags !== undefined) body.tags = tags;
      return call({
        promise: agent.api.user.packs({ packId: pack_id }).put(body),
        action: 'update pack',
        resourceHint: `pack ${pack_id}`,
      });
    },
  );

  // ── Delete pack ───────────────────────────────────────────────────────────

  tool<{ pack_id: string }>(
    agent.server,
    'packrat_delete_pack',
    {
      title: 'Delete Pack',
      description: 'Soft-delete a pack. The pack will no longer appear in listings.',
      inputSchema: {
        pack_id: z.string().describe('The unique pack ID to delete'),
      },
      annotations: {
        title: 'Delete Pack',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ pack_id }) =>
      call({
        promise: agent.api.user.packs({ packId: pack_id }).delete(),
        action: 'delete pack',
        resourceHint: `pack ${pack_id}`,
      }),
  );

  // ── List pack items ───────────────────────────────────────────────────────

  tool<{ pack_id: string }>(
    agent.server,
    'packrat_list_pack_items',
    {
      title: 'List Pack Items',
      description: 'List all items in a pack.',
      inputSchema: { pack_id: z.string().describe('The pack ID') },
      outputSchema: ListPackItemsOutputSchema.shape,
      annotations: {
        title: 'List Pack Items',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ pack_id }) => {
      const result = await agent.api.user.packs({ packId: pack_id }).items.get();
      if (result.error || result.data == null) {
        // Defer to the standard error envelope for failure consistency.
        return call({
          promise: Promise.resolve(result),
          action: 'list pack items',
          resourceHint: `pack ${pack_id}`,
        });
      }
      // The API returns a bare array; normalise into the `{ data, nextOffset }`
      // envelope the declared outputSchema expects.
      //
      // `nextOffset` is always null: this endpoint takes only `pack_id` and
      // returns every item in one response, so there is never a next page.
      // Don't route this through `withNextOffset` — passing `limit:
      // items.length` would make its `items.length >= limit` check true for
      // every response (including an empty pack), advertising a bogus
      // continuation offset that a consumer could follow into a loop.
      const items = Array.isArray(result.data) ? result.data : [];
      return ok({
        data: { data: items, nextOffset: null },
        structured: true,
      });
    },
  );

  // ── Get a single pack item ────────────────────────────────────────────────

  tool<{ item_id: string }>(
    agent.server,
    'packrat_get_pack_item',
    {
      title: 'Get Pack Item',
      description: 'Get full details of a single pack item.',
      inputSchema: { item_id: z.string().describe('The pack item ID') },
      outputSchema: GetPackItemOutputSchema.shape,
      annotations: {
        title: 'Get Pack Item',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ item_id }) =>
      call({
        promise: agent.api.user.packs.items({ itemId: item_id }).get(),
        action: 'get pack item',
        resourceHint: `item ${item_id}`,
        structured: true,
      }),
  );

  // ── Add item to pack ──────────────────────────────────────────────────────

  tool<{
    pack_id: string;
    name: string;
    category: ItemCategory;
    weight_grams: number;
    quantity: number;
    catalog_item_id?: number;
    is_consumable: boolean;
    is_worn: boolean;
    notes?: string;
  }>(
    agent.server,
    'packrat_add_pack_item',
    {
      title: 'Add Pack Item',
      description:
        'Add a gear item to a pack. Provide either a catalog_item_id (from packrat_search_gear_catalog, the semantic catalog search) or specify custom item details. Weight should be in grams.',
      inputSchema: {
        pack_id: z.string().describe('The pack ID to add the item to'),
        name: z.string().min(1).describe('Item name'),
        category: z.nativeEnum(ItemCategory).describe('Item category'),
        weight_grams: z.number().min(0).describe('Item weight in grams'),
        quantity: z.number().int().min(1).default(1).describe('Number of this item'),
        catalog_item_id: z
          .number()
          .int()
          .optional()
          .describe('Optional catalog item ID to link for specs and reviews'),
        is_consumable: z
          .boolean()
          .default(false)
          .describe('Whether the item is consumed (food, fuel, etc.)'),
        is_worn: z.boolean().default(false).describe('Whether the item is worn (clothing, shoes)'),
        notes: z.string().optional().describe('Optional notes about this item'),
      },
      annotations: {
        title: 'Add Pack Item',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({
      pack_id,
      name,
      category,
      weight_grams,
      quantity,
      catalog_item_id,
      is_consumable,
      is_worn,
      notes,
    }) =>
      call({
        promise: agent.api.user.packs({ packId: pack_id }).items.post({
          id: crypto.randomUUID(),
          name,
          category,
          weight: weight_grams,
          weightUnit: 'g',
          quantity,
          catalogItemId: catalog_item_id,
          consumable: is_consumable,
          worn: is_worn,
          notes,
        }),
        action: 'add pack item',
        resourceHint: `pack ${pack_id}`,
      }),
  );

  // ── Update pack item ──────────────────────────────────────────────────────

  tool<{
    item_id: string;
    name?: string;
    category?: ItemCategory;
    weight_grams?: number;
    quantity?: number;
    is_consumable?: boolean;
    is_worn?: boolean;
    notes?: string | null;
  }>(
    agent.server,
    'packrat_update_pack_item',
    {
      title: 'Update Pack Item',
      description: 'Update fields on an existing pack item.',
      inputSchema: {
        item_id: z.string().describe('The pack item ID'),
        name: z.string().min(1).optional(),
        category: z.nativeEnum(ItemCategory).optional(),
        weight_grams: z.number().min(0).optional(),
        quantity: z.number().int().min(1).optional(),
        is_consumable: z.boolean().optional(),
        is_worn: z.boolean().optional(),
        notes: z.string().nullable().optional(),
      },
      annotations: {
        title: 'Update Pack Item',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ item_id, name, category, weight_grams, quantity, is_consumable, is_worn, notes }) => {
      const body: Record<string, unknown> = { localUpdatedAt: nowIso() };
      if (name !== undefined) body.name = name;
      if (category !== undefined) body.category = category;
      if (weight_grams !== undefined) body.weight = weight_grams;
      if (quantity !== undefined) body.quantity = quantity;
      if (is_consumable !== undefined) body.consumable = is_consumable;
      if (is_worn !== undefined) body.worn = is_worn;
      if (notes !== undefined) body.notes = notes;
      return call({
        promise: agent.api.user.packs.items({ itemId: item_id }).patch(body),
        action: 'update pack item',
        resourceHint: `item ${item_id}`,
      });
    },
  );

  // ── Remove item from pack ─────────────────────────────────────────────────

  tool<{ item_id: string }>(
    agent.server,
    'packrat_remove_pack_item',
    {
      title: 'Remove Pack Item',
      description: 'Remove an item from a pack (soft-delete).',
      inputSchema: { item_id: z.string().describe('The item ID to remove') },
      annotations: {
        title: 'Remove Pack Item',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ item_id }) =>
      call({
        promise: agent.api.user.packs.items({ itemId: item_id }).delete(),
        action: 'delete pack item',
        resourceHint: `item ${item_id}`,
      }),
  );

  // ── Similar items for an item in a pack ───────────────────────────────────

  tool<{
    pack_id: string;
    item_id: string;
    limit: number;
    threshold?: number;
    lighter_only?: boolean;
  }>(
    agent.server,
    'packrat_similar_pack_items',
    {
      title: 'Find Similar Pack Items',
      description:
        "Find catalog gear comparable to a specific item already in a pack — the tool for swapping or upgrading an item, including finding a lighter replacement. Takes the pack item's `item_id`, which is returned by `packrat_list_pack_items`, `packrat_add_pack_item`, and in the `byCategory[].items[].id` field of `packrat_analyze_pack_weight`. Set `lighter_only: true` whenever the user wants a lighter replacement — results are otherwise ranked by semantic similarity alone and will include items heavier than the source.",
      inputSchema: {
        pack_id: z.string(),
        item_id: z.string(),
        limit: z.number().int().min(1).max(50).default(10),
        threshold: z.number().min(0).max(1).optional().describe('Similarity threshold (0-1)'),
        lighter_only: z
          .boolean()
          .optional()
          .describe(
            'Return only catalog items weighing less than the source pack item. Weights normalise to grams server-side, so mixed g/kg/oz/lb rows compare correctly.',
          ),
      },
      annotations: {
        title: 'Find Similar Pack Items',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ pack_id, item_id, limit, threshold, lighter_only }) =>
      call({
        promise: agent.api.user
          .packs({ packId: pack_id })
          .items({ itemId: item_id })
          .similar.get({
            query: {
              limit: String(limit),
              ...(threshold !== undefined ? { threshold: String(threshold) } : {}),
              ...(lighter_only ? { lighter_only: 'true' } : {}),
            },
          }),
        action: 'find similar items',
        resourceHint: `item ${item_id}`,
      }),
  );

  // ── Pack item suggestions ─────────────────────────────────────────────────

  tool<{ pack_id: string; existing_catalog_item_ids: number[] }>(
    agent.server,
    'packrat_suggest_pack_items',
    {
      title: 'Suggest Pack Items',
      description: 'Return catalog item suggestions for a pack based on the items already in it.',
      inputSchema: {
        pack_id: z.string(),
        existing_catalog_item_ids: z.array(z.number().int()).default([]),
      },
      annotations: {
        title: 'Suggest Pack Items',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ pack_id, existing_catalog_item_ids }) =>
      call({
        promise: agent.api.user
          .packs({ packId: pack_id })
          ['item-suggestions'].post({ existingCatalogItemIds: existing_catalog_item_ids }),
        action: 'suggest pack items',
        resourceHint: `pack ${pack_id}`,
      }),
  );

  // ── Weight history ────────────────────────────────────────────────────────

  tool<Record<string, never>>(
    agent.server,
    'packrat_get_pack_weight_history',
    {
      title: 'Get Pack Weight History',
      description: "Get the weight history for all of the user's packs over time.",
      inputSchema: {},
      annotations: {
        title: 'Get Pack Weight History',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () =>
      call({
        promise: agent.api.user.packs['weight-history'].get(),
        action: 'list pack weight history',
      }),
  );

  tool<{ pack_id: string; weight_grams: number }>(
    agent.server,
    'packrat_record_pack_weight',
    {
      title: 'Record Pack Weight',
      description: 'Record a weight measurement for a pack at a specific point in time.',
      inputSchema: { pack_id: z.string(), weight_grams: z.number().min(0) },
      annotations: {
        title: 'Record Pack Weight',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ pack_id, weight_grams }) =>
      call({
        promise: agent.api.user.packs({ packId: pack_id })['weight-history'].post({
          id: crypto.randomUUID(),
          weight: weight_grams,
          localCreatedAt: nowIso(),
        }),
        action: 'record pack weight',
        resourceHint: `pack ${pack_id}`,
      }),
  );

  // ── Pack weight analysis (server-computed breakdown) ─────────────────────
  tool<{ pack_id: string }>(
    agent.server,
    'packrat_analyze_pack_weight',
    {
      title: 'Analyze Pack Weight',
      description:
        'Return a detailed weight breakdown for a pack: total / base / worn / consumable grams plus a per-category aggregation sorted heaviest first.',
      inputSchema: { pack_id: z.string().describe('The pack ID to analyze') },
      annotations: {
        title: 'Analyze Pack Weight',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ pack_id }) =>
      call({
        promise: agent.api.user.packs({ packId: pack_id })['weight-breakdown'].get(),
        action: 'analyze pack weight',
        resourceHint: `pack ${pack_id}`,
      }),
  );

  // ── Gap analysis ──────────────────────────────────────────────────────────

  tool<{
    pack_id: string;
    destination?: string;
    trip_type?: PackCategory;
    duration_days?: number;
    start_date?: string;
    end_date?: string;
  }>(
    agent.server,
    'packrat_analyze_pack_gaps',
    {
      title: 'Analyze Pack Gaps',
      description:
        "Identify missing essential gear categories for a specific trip context. Compares the pack's current categories against recommended essentials and returns what's missing. Only pack_id is required — when the user doesn't state a destination, trip type, or duration, this falls back to a general 2-day backpacking context rather than failing.",
      inputSchema: {
        pack_id: z.string().describe('The pack ID to analyze'),
        destination: z
          .string()
          .optional()
          .describe("Trip destination; defaults to 'Unspecified' when the user hasn't named one"),
        trip_type: z
          .nativeEnum(PackCategory)
          .optional()
          .describe(`Trip / activity type; defaults to '${PackCategory.Backpacking}'`),
        duration_days: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe('Trip duration in days; defaults to 2'),
        start_date: z.string().optional().describe('ISO date for trip start'),
        end_date: z.string().optional().describe('ISO date for trip end'),
      },
      annotations: {
        title: 'Analyze Pack Gaps',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ pack_id, destination, trip_type, duration_days, start_date, end_date }) =>
      call({
        // Defaults keep the tool usable from a bare "what am I missing?" prompt.
        // The upstream endpoint requires all three, so a missing field would
        // otherwise surface as a validation error rather than an answer.
        promise: agent.api.user.packs({ packId: pack_id })['gap-analysis'].post({
          destination: destination ?? 'Unspecified',
          tripType: trip_type ?? PackCategory.Backpacking,
          duration: duration_days ?? 2,
          startDate: start_date,
          endDate: end_date,
        }),
        action: 'analyze pack gaps',
        resourceHint: `pack ${pack_id}`,
      }),
  );

  // ── Image-based gear detection — DISABLED ─────────────────────────────────
  // Not usable on the connector: it requires an R2 image key that only
  // packrat_upload_image_url can mint, and a Claude.ai user's uploaded photo
  // can never reach that upload flow. MCP tool *inputs* are JSON-only —
  // ImageContent is valid only in tool *results*, and the model cannot
  // re-emit image bytes it was shown (vision input is one-way). So there is
  // no path for a user's photo to reach this tool. Confirmed against the MCP
  // tools spec + python-sdk #499/#771. "Pack from image" belongs in the
  // PackRat app (which has the photo + an auth'd session), not the connector.
  //
  // tool<{ image_key: string; match_limit: number }>(
  //   agent.server,
  //   'packrat_analyze_pack_image',
  //   {
  //     title: 'Analyze Pack Image',
  //     description:
  //       'Submit a gear image (R2 key from packrat_upload_image_url) for item detection. Returns detected items with catalog matches.',
  //     inputSchema: {
  //       image_key: z.string().describe('R2 image key from a presigned upload'),
  //       match_limit: z
  //         .number()
  //         .int()
  //         .min(1)
  //         .max(20)
  //         .default(5)
  //         .describe('Max catalog matches per detected item'),
  //     },
  //     annotations: {
  //       title: 'Analyze Pack Image',
  //       readOnlyHint: true,
  //       destructiveHint: false,
  //       idempotentHint: false,
  //       openWorldHint: true,
  //     },
  //   },
  //   withDebug('packrat_analyze_pack_image', async ({ image_key, match_limit }) => {
  //     dbgUpstream('packrat_analyze_pack_image', {
  //       label: 'POST user.packs.analyze-image',
  //       payload: {
  //         image: image_key,
  //         matchLimit: match_limit,
  //       },
  //     });
  //     return call({
  //       promise: agent.api.user.packs['analyze-image'].post({
  //         image: image_key,
  //         matchLimit: match_limit,
  //       }),
  //       action: 'analyze pack image',
  //     });
  //   }),
  // );
}
