import { z } from 'zod';
import { call, nowIso, shortId } from '../client';
import { ItemCategory, PackCategory } from '../enums';
import type { AgentContext } from '../types';

export function registerPackTemplateTools(agent: AgentContext): void {
  // ── Templates ─────────────────────────────────────────────────────────────

  agent.server.registerTool(
    'list_pack_templates',
    {
      description: 'List both user-owned and app-curated pack templates.',
      inputSchema: {},
    },
    async () =>
      call(agent.api.user['pack-templates'].get(), { action: 'list pack templates' }),
  );

  agent.server.registerTool(
    'get_pack_template',
    {
      description: 'Get a pack template with its items.',
      inputSchema: { template_id: z.string() },
    },
    async ({ template_id }) =>
      call(agent.api.user['pack-templates']({ templateId: template_id }).get(), {
        action: 'get pack template',
        resourceHint: `template ${template_id}`,
      }),
  );

  agent.server.registerTool(
    'create_pack_template',
    {
      description:
        'Create a pack template. Set is_app_template=true to create a curated app template (admin only).',
      inputSchema: {
        name: z.string().min(1),
        description: z.string().optional(),
        category: z.nativeEnum(PackCategory),
        image: z.string().optional(),
        tags: z.array(z.string()).optional(),
        is_app_template: z.boolean().default(false),
      },
    },
    async ({ name, description, category, image, tags, is_app_template }) => {
      const id = shortId('pt');
      const now = nowIso();
      return call(
        agent.api.user['pack-templates'].post({
          id,
          name,
          description,
          category,
          image,
          tags,
          isAppTemplate: is_app_template,
          localCreatedAt: now,
          localUpdatedAt: now,
        }),
        { action: 'create pack template' },
      );
    },
  );

  agent.server.registerTool(
    'update_pack_template',
    {
      description: 'Update a pack template.',
      inputSchema: {
        template_id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        category: z.nativeEnum(PackCategory).optional(),
        image: z.string().optional(),
        tags: z.array(z.string()).optional(),
      },
    },
    async ({ template_id, name, description, category, image, tags }) => {
      const body: Record<string, unknown> = { localUpdatedAt: nowIso() };
      if (name !== undefined) body.name = name;
      if (description !== undefined) body.description = description;
      if (category !== undefined) body.category = category;
      if (image !== undefined) body.image = image;
      if (tags !== undefined) body.tags = tags;
      return call(agent.api.user['pack-templates']({ templateId: template_id }).put(body), {
        action: 'update pack template',
        resourceHint: `template ${template_id}`,
      });
    },
  );

  agent.server.registerTool(
    'delete_pack_template',
    {
      description: 'Delete a pack template.',
      inputSchema: { template_id: z.string() },
    },
    async ({ template_id }) =>
      call(agent.api.user['pack-templates']({ templateId: template_id }).delete(), {
        action: 'delete pack template',
        resourceHint: `template ${template_id}`,
      }),
  );

  // ── Template items ────────────────────────────────────────────────────────

  agent.server.registerTool(
    'list_pack_template_items',
    {
      description: 'List items inside a pack template.',
      inputSchema: { template_id: z.string() },
    },
    async ({ template_id }) =>
      call(agent.api.user['pack-templates']({ templateId: template_id }).items.get(), {
        action: 'list pack template items',
        resourceHint: `template ${template_id}`,
      }),
  );

  agent.server.registerTool(
    'add_pack_template_item',
    {
      description: 'Add an item to a pack template.',
      inputSchema: {
        template_id: z.string(),
        name: z.string().min(1),
        description: z.string().optional(),
        weight: z.number().min(0),
        weight_unit: z.enum(['g', 'oz', 'kg', 'lb']).default('g'),
        quantity: z.number().int().min(1).default(1),
        category: z.nativeEnum(ItemCategory),
        consumable: z.boolean().default(false),
        worn: z.boolean().default(false),
        image: z.string().optional(),
        notes: z.string().optional(),
      },
    },
    async ({
      template_id,
      name,
      description,
      weight,
      weight_unit,
      quantity,
      category,
      consumable,
      worn,
      image,
      notes,
    }) => {
      const id = shortId('pti');
      return call(
        agent.api.user['pack-templates']({ templateId: template_id }).items.post({
          id,
          name,
          description,
          weight,
          weightUnit: weight_unit,
          quantity,
          category,
          consumable,
          worn,
          image,
          notes,
        }),
        { action: 'add template item', resourceHint: `template ${template_id}` },
      );
    },
  );

  agent.server.registerTool(
    'update_pack_template_item',
    {
      description: 'Update a pack template item.',
      inputSchema: {
        item_id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        weight: z.number().min(0).optional(),
        weight_unit: z.enum(['g', 'oz', 'kg', 'lb']).optional(),
        quantity: z.number().int().min(1).optional(),
        category: z.nativeEnum(ItemCategory).optional(),
        consumable: z.boolean().optional(),
        worn: z.boolean().optional(),
        notes: z.string().optional(),
      },
    },
    async ({ item_id, ...fields }) => {
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) {
        if (v === undefined) continue;
        const camel = k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
        body[camel] = v;
      }
      return call(agent.api.user['pack-templates'].items({ itemId: item_id }).patch(body), {
        action: 'update template item',
        resourceHint: `item ${item_id}`,
      });
    },
  );

  agent.server.registerTool(
    'delete_pack_template_item',
    {
      description: 'Delete a pack template item.',
      inputSchema: { item_id: z.string() },
    },
    async ({ item_id }) =>
      call(agent.api.user['pack-templates'].items({ itemId: item_id }).delete(), {
        action: 'delete template item',
        resourceHint: `item ${item_id}`,
      }),
  );

  // ── Generate from online content (admin-only on the API side) ─────────────

  agent.server.registerTool(
    'generate_pack_template_from_url',
    {
      description:
        'Generate a pack template from a TikTok or YouTube link (admin-only). Use admin_login first.',
      inputSchema: {
        content_url: z.string().url(),
        is_app_template: z.boolean().default(false),
      },
    },
    async ({ content_url, is_app_template }) =>
      call(
        agent.api.user['pack-templates']['generate-from-online-content'].post({
          contentUrl: content_url,
          isAppTemplate: is_app_template,
        }),
        { action: 'generate pack template from URL', requiresAdmin: true },
      ),
  );
}
