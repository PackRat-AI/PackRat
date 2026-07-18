import { z } from 'zod';
import { normalizePackSnapshot, PACK_WIDGET_URI } from '../apps/pack-widget';
import { call, errMessage, nowIso, okStructured } from '../client';
import { ItemCategory, PackCategory } from '../enums';
import type { AgentContext } from '../types';

export function registerPackTools(agent: AgentContext): void {
  // ── List packs ────────────────────────────────────────────────────────────

  agent.server.registerTool(
    'list_packs',
    {
      description:
        'List all packs belonging to the authenticated user. Returns pack summaries including name, category, item count, and total weight.',
      inputSchema: {
        include_public: z
          .boolean()
          .default(false)
          .describe('Include public packs from other users'),
      },
    },
    async ({ include_public }) =>
      call({
        promise: agent.api.user.packs.get({ query: { includePublic: include_public ? 1 : 0 } }),
        action: 'list packs',
      }),
  );

  // ── Get pack details ──────────────────────────────────────────────────────

  agent.server.registerTool(
    'get_pack',
    {
      description:
        'Get complete details of a single pack including all items with weights, categories, and computed totals. Use this to analyze pack weight, find gear gaps, or suggest optimizations.',
      inputSchema: {
        pack_id: z.string().describe('The unique pack ID (e.g. "p_abc123")'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: PACK_WIDGET_URI },
        'openai/outputTemplate': PACK_WIDGET_URI,
        'openai/toolInvocation/invoking': 'Loading pack…',
        'openai/toolInvocation/invoked': 'Pack loaded',
      },
    },
    async ({ pack_id }) =>
      call({
        promise: agent.api.user.packs({ packId: pack_id }).get(),
        action: 'get pack',
        resourceHint: `pack ${pack_id}`,
        onSuccess: (data) => {
          const snapshot = normalizePackSnapshot(data);
          if (!snapshot) return errMessage('get pack returned malformed data');
          return okStructured(snapshot);
        },
      }),
  );

  // ── Create pack ───────────────────────────────────────────────────────────

  agent.server.registerTool(
    'create_pack',
    {
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
    },
    async ({ name, description, category, is_public, tags }) => {
      const now = nowIso();
      return call({
        promise: agent.api.user.packs.post({
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

  agent.server.registerTool(
    'update_pack',
    {
      description: "Update a pack's name, description, category, visibility, or tags.",
      inputSchema: {
        pack_id: z.string().describe('The unique pack ID to update'),
        name: z.string().min(1).optional().describe('New pack name'),
        description: z.string().optional().nullable().describe('New description'),
        category: z.nativeEnum(PackCategory).optional().describe('New category'),
        is_public: z.boolean().optional().describe('Update public visibility'),
        tags: z.array(z.string()).optional().describe('New tags (replaces existing tags)'),
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

  agent.server.registerTool(
    'delete_pack',
    {
      description: 'Soft-delete a pack. The pack will no longer appear in listings.',
      inputSchema: {
        pack_id: z.string().describe('The unique pack ID to delete'),
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

  agent.server.registerTool(
    'list_pack_items',
    {
      description: 'List all items in a pack.',
      inputSchema: { pack_id: z.string().describe('The pack ID') },
    },
    async ({ pack_id }) =>
      call({
        promise: agent.api.user.packs({ packId: pack_id }).items.get(),
        action: 'list pack items',
        resourceHint: `pack ${pack_id}`,
      }),
  );

  // ── Get a single pack item ────────────────────────────────────────────────

  agent.server.registerTool(
    'get_pack_item',
    {
      description: 'Get full details of a single pack item.',
      inputSchema: { item_id: z.string().describe('The pack item ID') },
    },
    async ({ item_id }) =>
      call({
        promise: agent.api.user.packs.items({ itemId: item_id }).get(),
        action: 'get pack item',
        resourceHint: `item ${item_id}`,
      }),
  );

  // ── Add item to pack ──────────────────────────────────────────────────────

  agent.server.registerTool(
    'add_pack_item',
    {
      description:
        'Add a gear item to a pack. Provide either a catalog_item_id (from search_gear_catalog) or specify custom item details. Weight should be in grams.',
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
          name,
          category,
          weight: weight_grams,
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

  agent.server.registerTool(
    'update_pack_item',
    {
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

  agent.server.registerTool(
    'remove_pack_item',
    {
      description: 'Remove an item from a pack (soft-delete).',
      inputSchema: { item_id: z.string().describe('The item ID to remove') },
    },
    async ({ item_id }) =>
      call({
        promise: agent.api.user.packs.items({ itemId: item_id }).delete(),
        action: 'delete pack item',
        resourceHint: `item ${item_id}`,
      }),
  );

  // ── Similar items for an item in a pack ───────────────────────────────────

  agent.server.registerTool(
    'similar_pack_items',
    {
      description: 'Find catalog gear similar to a specific item in a pack (semantic similarity).',
      inputSchema: {
        pack_id: z.string(),
        item_id: z.string(),
        limit: z.number().int().min(1).max(50).default(10),
        threshold: z.number().min(0).max(1).optional().describe('Similarity threshold (0-1)'),
      },
    },
    async ({ pack_id, item_id, limit, threshold }) =>
      call({
        promise: agent.api.user
          .packs({ packId: pack_id })
          .items({ itemId: item_id })
          .similar.get({ query: { limit, ...(threshold !== undefined ? { threshold } : {}) } }),
        action: 'find similar items',
        resourceHint: `item ${item_id}`,
      }),
  );

  // ── Pack item suggestions ─────────────────────────────────────────────────

  agent.server.registerTool(
    'suggest_pack_items',
    {
      description:
        'Get AI-driven catalog item suggestions for a pack based on the items already in it.',
      inputSchema: {
        pack_id: z.string(),
        existing_catalog_item_ids: z.array(z.number().int()).default([]),
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

  agent.server.registerTool(
    'get_pack_weight_history',
    {
      description: "Get the weight history for all of the user's packs over time.",
      inputSchema: {},
    },
    async () =>
      call({
        promise: agent.api.user.packs['weight-history'].get(),
        action: 'list pack weight history',
      }),
  );

  agent.server.registerTool(
    'record_pack_weight',
    {
      description: 'Record a weight measurement for a pack at a specific point in time.',
      inputSchema: { pack_id: z.string(), weight_grams: z.number().min(0) },
    },
    async ({ pack_id, weight_grams }) =>
      call({
        promise: agent.api.user
          .packs({ packId: pack_id })
          ['weight-history'].post({ weight: weight_grams, localCreatedAt: nowIso() }),
        action: 'record pack weight',
        resourceHint: `pack ${pack_id}`,
      }),
  );

  // ── Pack weight analysis (server-computed breakdown) ─────────────────────
  agent.server.registerTool(
    'analyze_pack_weight',
    {
      description:
        'Get a detailed weight breakdown for a pack: total / base / worn / consumable grams plus a per-category aggregation sorted heaviest first.',
      inputSchema: { pack_id: z.string().describe('The pack ID to analyze') },
    },
    async ({ pack_id }) =>
      call({
        promise: agent.api.user.packs({ packId: pack_id })['weight-breakdown'].get(),
        action: 'analyze pack weight',
        resourceHint: `pack ${pack_id}`,
      }),
  );

  // ── Gap analysis ──────────────────────────────────────────────────────────

  agent.server.registerTool(
    'analyze_pack_gaps',
    {
      description:
        "Identify missing essential gear categories for a specific trip context. Compares the pack's current categories against recommended essentials and returns what's missing.",
      inputSchema: {
        pack_id: z.string().describe('The pack ID to analyze'),
        destination: z.string().describe('Trip destination'),
        trip_type: z.nativeEnum(PackCategory).describe('Trip / activity type'),
        duration_days: z.number().int().min(1).describe('Trip duration in days'),
        start_date: z.string().optional().describe('ISO date for trip start'),
        end_date: z.string().optional().describe('ISO date for trip end'),
      },
    },
    async ({ pack_id, destination, trip_type, duration_days, start_date, end_date }) =>
      call({
        promise: agent.api.user.packs({ packId: pack_id })['gap-analysis'].post({
          destination,
          tripType: trip_type,
          duration: duration_days,
          startDate: start_date,
          endDate: end_date,
        }),
        action: 'analyze pack gaps',
        resourceHint: `pack ${pack_id}`,
      }),
  );

  // ── Image-based gear detection ───────────────────────────────────────────

  agent.server.registerTool(
    'analyze_pack_image',
    {
      description:
        'Submit a gear image (R2 key from upload_image_url) for AI-powered item detection. Returns detected items with catalog matches.',
      inputSchema: {
        image_key: z.string().describe('R2 image key from a presigned upload'),
        match_limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .default(5)
          .describe('Max catalog matches per detected item'),
      },
    },
    async ({ image_key, match_limit }) =>
      call({
        promise: agent.api.user.packs['analyze-image'].post({
          image: image_key,
          matchLimit: match_limit,
        }),
        action: 'analyze pack image',
      }),
  );
}
