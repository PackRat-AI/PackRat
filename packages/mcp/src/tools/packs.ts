import { z } from 'zod';
import { err, ok } from '../client';
import type { PackRatMCP } from '../index';

export function registerPackTools(agent: PackRatMCP): void {
  // ── List packs ────────────────────────────────────────────────────────────

  agent.server.registerTool(
    'list_packs',
    {
      description:
        'List all packs belonging to the authenticated user. Returns pack summaries including name, category, item count, and total weight.',
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(20)
          .describe('Maximum number of packs to return (default 20)'),
        offset: z.number().int().min(0).default(0).describe('Pagination offset (default 0)'),
        category: z
          .string()
          .optional()
          .describe(
            'Filter by pack category (e.g. "backpacking", "camping", "climbing", "cycling")',
          ),
      },
    },
    async ({ limit, offset, category }) => {
      try {
        const data = await agent.api.get('/packs', { limit, offset, category });
        return ok(data);
      } catch (e) {
        return err(e);
      }
    },
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
    },
    async ({ pack_id }) => {
      try {
        const data = await agent.api.get(`/packs/${pack_id}`);
        return ok(data);
      } catch (e) {
        return err(e);
      }
    },
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
        category: z
          .string()
          .describe(
            'Pack category — one of: backpacking, camping, climbing, cycling, hiking, skiing, travel, general',
          ),
        is_public: z
          .boolean()
          .default(false)
          .describe('Whether this pack is publicly discoverable by other users'),
        tags: z.array(z.string()).optional().describe('Optional tags for the pack'),
      },
    },
    async ({ name, description, category, is_public, tags }) => {
      try {
        const id = `p_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
        const now = new Date().toISOString();
        const data = await agent.api.post('/packs', {
          id,
          name,
          description,
          category,
          isPublic: is_public,
          tags,
          localCreatedAt: now,
          localUpdatedAt: now,
        });
        return ok(data);
      } catch (e) {
        return err(e);
      }
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
        category: z.string().optional().describe('New category'),
        is_public: z.boolean().optional().describe('Update public visibility'),
        tags: z.array(z.string()).optional().describe('New tags (replaces existing tags)'),
      },
    },
    async ({ pack_id, name, description, category, is_public, tags }) => {
      try {
        const body: Record<string, unknown> = { localUpdatedAt: new Date().toISOString() };
        if (name !== undefined) body.name = name;
        if (description !== undefined) body.description = description;
        if (category !== undefined) body.category = category;
        if (is_public !== undefined) body.isPublic = is_public;
        if (tags !== undefined) body.tags = tags;
        const data = await agent.api.patch(`/packs/${pack_id}`, body);
        return ok(data);
      } catch (e) {
        return err(e);
      }
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
    async ({ pack_id }) => {
      try {
        const data = await agent.api.delete(`/packs/${pack_id}`);
        return ok(data);
      } catch (e) {
        return err(e);
      }
    },
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
        category: z
          .string()
          .describe(
            'Item category (e.g. "shelter", "sleep", "clothing", "footwear", "navigation", "safety", "food", "water", "hygiene", "tools")',
          ),
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
    }) => {
      try {
        const id = `i_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
        const now = new Date().toISOString();
        const data = await agent.api.post(`/packs/${pack_id}/items`, {
          id,
          name,
          category,
          weight: weight_grams,
          quantity,
          catalogItemId: catalog_item_id,
          consumable: is_consumable,
          worn: is_worn,
          notes,
          localCreatedAt: now,
          localUpdatedAt: now,
        });
        return ok(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── Remove item from pack ─────────────────────────────────────────────────

  agent.server.registerTool(
    'remove_pack_item',
    {
      description: 'Remove an item from a pack (soft-delete).',
      inputSchema: {
        pack_id: z.string().describe('The pack ID'),
        item_id: z.string().describe('The item ID to remove'),
      },
    },
    async ({ pack_id, item_id }) => {
      try {
        const data = await agent.api.delete(`/packs/${pack_id}/items/${item_id}`);
        return ok(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── Pack weight analysis ──────────────────────────────────────────────────

  agent.server.registerTool(
    'analyze_pack_weight',
    {
      description:
        'Get a detailed weight breakdown for a pack by category. Returns base weight, worn weight, consumable weight, and total weight with per-category summaries. Useful for identifying the heaviest items and optimization opportunities.',
      inputSchema: {
        pack_id: z.string().describe('The pack ID to analyze'),
      },
    },
    async ({ pack_id }) => {
      try {
        const pack = (await agent.api.get(`/packs/${pack_id}`)) as {
          items?: Array<{
            name: string;
            category: string;
            weight: number;
            quantity: number;
            worn: boolean;
            consumable: boolean;
          }>;
          totalWeight?: number;
          baseWeight?: number;
          wornWeight?: number;
          consumableWeight?: number;
        };

        const byCategory: Record<string, { items: string[]; totalGrams: number; count: number }> =
          {};
        const items = pack.items ?? [];

        for (const item of items) {
          const cat = item.category || 'Uncategorized';
          const entry = byCategory[cat] ?? { items: [], totalGrams: 0, count: 0 };
          entry.items.push(`${item.name} (${item.weight}g × ${item.quantity})`);
          entry.totalGrams += item.weight * item.quantity;
          entry.count += item.quantity;
          byCategory[cat] = entry;
        }

        const analysis = {
          packId: pack_id,
          totalWeight: pack.totalWeight ?? 0,
          baseWeight: pack.baseWeight ?? 0,
          wornWeight: pack.wornWeight ?? 0,
          consumableWeight: pack.consumableWeight ?? 0,
          itemCount: items.length,
          byCategory: Object.entries(byCategory)
            .sort((a, b) => b[1].totalGrams - a[1].totalGrams)
            .map(([category, stats]) => ({
              category,
              totalGrams: stats.totalGrams,
              totalLbs: (stats.totalGrams / 453.592).toFixed(2),
              itemCount: stats.count,
              items: stats.items,
            })),
        };

        return ok(analysis);
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── Pack gap analysis ─────────────────────────────────────────────────────

  agent.server.registerTool(
    'analyze_pack_gaps',
    {
      description:
        "Identify missing essential gear categories for a specific activity type. Compares the pack's current categories against recommended essentials and returns what's missing.",
      inputSchema: {
        pack_id: z.string().describe('The pack ID to analyze'),
        activity: z
          .string()
          .describe(
            'Activity type: backpacking, camping, climbing, hiking, skiing, cycling, or travel',
          ),
        duration_days: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe('Trip duration in days (affects consumable recommendations)'),
      },
    },
    async ({ pack_id, activity, duration_days }) => {
      try {
        const data = await agent.api.post(`/packs/${pack_id}/gap-analysis`, {
          activity,
          durationDays: duration_days,
        });
        return ok(data);
      } catch (e) {
        return err(e);
      }
    },
  );
}
