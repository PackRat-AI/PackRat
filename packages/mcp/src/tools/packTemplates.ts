/**
 * Pack template tools.
 *
 * U7 split:
 *  - `packrat_create_pack_template` — user-level. `is_app_template` is
 *    hardcoded to `false` (no longer a caller-supplied parameter), so the
 *    write-vs-admin distinction is no longer collapsed into a single
 *    boolean. This is the doc-review finding called out in the U7 plan.
 *  - `packrat_create_app_pack_template` — admin-only equivalent.
 *    `is_app_template` is hardcoded to `true`. Visibility is enforced by
 *    the `create_app_pack_template` entry in `EXPLICIT_ADMIN` in
 *    `scopes.ts` (the `admin_` prefix convention can't apply here because
 *    the tool needs the `packrat_create_*` shape to read as a "create").
 *
 * The `packrat_generate_pack_template_from_url` tool is admin-only on the
 * API side. U7 also hides it from non-admin OAuth sessions via the
 * `EXPLICIT_ADMIN` set so the MCP `tools/list` matches what the user can
 * actually call.
 */

import { z } from 'zod';
import { call, nowIso } from '../client';
import { ItemCategory, PackCategory } from '../enums';
import type { AgentContext } from '../types';

export function registerPackTemplateTools(agent: AgentContext): void {
  // ── Templates ─────────────────────────────────────────────────────────────

  agent.server.registerTool(
    'packrat_list_pack_templates',
    {
      title: 'List Pack Templates',
      description: 'List both user-owned and app-curated pack templates.',
      inputSchema: {},
      annotations: {
        title: 'List Pack Templates',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => call(agent.api.user['pack-templates'].get(), { action: 'list pack templates' }),
  );

  agent.server.registerTool(
    'packrat_get_pack_template',
    {
      title: 'Get Pack Template',
      description: 'Get a pack template with its items.',
      inputSchema: { template_id: z.string() },
      annotations: {
        title: 'Get Pack Template',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ template_id }) =>
      call(agent.api.user['pack-templates']({ templateId: template_id }).get(), {
        action: 'get pack template',
        resourceHint: `template ${template_id}`,
      }),
  );

  // ── Create pack template (user-level) ─────────────────────────────────────
  // `is_app_template` is forced to `false` here; the admin variant lives in
  // `packrat_create_app_pack_template` below.

  agent.server.registerTool(
    'packrat_create_pack_template',
    {
      title: 'Create Pack Template',
      description:
        'Create a personal pack template visible only to you. To create a curated app template, use packrat_create_app_pack_template (admin-only).',
      inputSchema: {
        name: z.string().min(1),
        description: z.string().optional(),
        category: z.nativeEnum(PackCategory),
        image: z.string().optional(),
        tags: z.array(z.string()).optional(),
      },
      annotations: {
        title: 'Create Pack Template',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ name, description, category, image, tags }) => {
      const now = nowIso();
      return call(
        agent.api.user['pack-templates'].post({
          name,
          description,
          category,
          image,
          tags,
          isAppTemplate: false,
          localCreatedAt: now,
          localUpdatedAt: now,
        }),
        { action: 'create pack template' },
      );
    },
  );

  // ── Create app pack template (admin-only) ────────────────────────────────
  // Same surface as `packrat_create_pack_template` but `is_app_template` is
  // forced to `true`. Admin-gated via the `create_app_pack_template` entry
  // in `EXPLICIT_ADMIN` in `scopes.ts` (the tool doesn't carry the
  // `admin_` prefix so the prefix-based classifier can't pick it up).

  agent.server.registerTool(
    'packrat_create_app_pack_template',
    {
      title: 'Create App Pack Template (Admin)',
      description:
        'Create a curated app-level pack template visible to all users. Admin-only — also requires the mcp:admin OAuth scope. For personal templates use packrat_create_pack_template.',
      inputSchema: {
        name: z.string().min(1),
        description: z.string().optional(),
        category: z.nativeEnum(PackCategory),
        image: z.string().optional(),
        tags: z.array(z.string()).optional(),
      },
      annotations: {
        title: 'Create App Pack Template (Admin)',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ name, description, category, image, tags }) => {
      const now = nowIso();
      return call(
        agent.api.user['pack-templates'].post({
          name,
          description,
          category,
          image,
          tags,
          isAppTemplate: true,
          localCreatedAt: now,
          localUpdatedAt: now,
        }),
        { action: 'create app pack template', requiresAdmin: true },
      );
    },
  );

  agent.server.registerTool(
    'packrat_update_pack_template',
    {
      title: 'Update Pack Template',
      description: 'Update a pack template.',
      inputSchema: {
        template_id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        category: z.nativeEnum(PackCategory).optional(),
        image: z.string().optional(),
        tags: z.array(z.string()).optional(),
      },
      annotations: {
        title: 'Update Pack Template',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
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
    'packrat_delete_pack_template',
    {
      title: 'Delete Pack Template',
      description: 'Delete a pack template.',
      inputSchema: { template_id: z.string() },
      annotations: {
        title: 'Delete Pack Template',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ template_id }) =>
      call(agent.api.user['pack-templates']({ templateId: template_id }).delete(), {
        action: 'delete pack template',
        resourceHint: `template ${template_id}`,
      }),
  );

  // ── Template items ────────────────────────────────────────────────────────

  agent.server.registerTool(
    'packrat_list_pack_template_items',
    {
      title: 'List Pack Template Items',
      description: 'List items inside a pack template.',
      inputSchema: { template_id: z.string() },
      annotations: {
        title: 'List Pack Template Items',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ template_id }) =>
      call(agent.api.user['pack-templates']({ templateId: template_id }).items.get(), {
        action: 'list pack template items',
        resourceHint: `template ${template_id}`,
      }),
  );

  agent.server.registerTool(
    'packrat_add_pack_template_item',
    {
      title: 'Add Pack Template Item',
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
      annotations: {
        title: 'Add Pack Template Item',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
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
    }) =>
      call(
        agent.api.user['pack-templates']({ templateId: template_id }).items.post({
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
      ),
  );

  agent.server.registerTool(
    'packrat_update_pack_template_item',
    {
      title: 'Update Pack Template Item',
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
        image: z.string().optional(),
        notes: z.string().optional(),
      },
      annotations: {
        title: 'Update Pack Template Item',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ item_id, ...fields }) => {
      // Explicit snake→camel rename avoids a raw regex; keys are stable
      // because the input schema is fixed at registration time.
      const SNAKE_TO_CAMEL: Record<string, string> = { weight_unit: 'weightUnit' };
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) {
        if (v === undefined) continue;
        body[SNAKE_TO_CAMEL[k] ?? k] = v;
      }
      return call(agent.api.user['pack-templates'].items({ itemId: item_id }).patch(body), {
        action: 'update template item',
        resourceHint: `item ${item_id}`,
      });
    },
  );

  agent.server.registerTool(
    'packrat_delete_pack_template_item',
    {
      title: 'Delete Pack Template Item',
      description: 'Delete a pack template item.',
      inputSchema: { item_id: z.string() },
      annotations: {
        title: 'Delete Pack Template Item',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ item_id }) =>
      call(agent.api.user['pack-templates'].items({ itemId: item_id }).delete(), {
        action: 'delete template item',
        resourceHint: `item ${item_id}`,
      }),
  );

  // ── Generate from online content (admin-only on the API side) ─────────────
  // U7 adds this tool to EXPLICIT_ADMIN in scopes.ts so the MCP-level
  // surface matches what the API enforces — non-admin OAuth sessions don't
  // see it in tools/list.

  agent.server.registerTool(
    'packrat_generate_pack_template_from_url',
    {
      title: 'Generate Pack Template From URL (Admin)',
      description:
        'Generate a pack template from a TikTok or YouTube link. Admin-only — the server gates this on `user.role === "ADMIN"` on the OAuth-authenticated user, and MCP hides it from non-admin sessions. The `mcp:admin` scope is granted at OAuth callback time when the Better Auth role resolves to ADMIN.',
      inputSchema: {
        content_url: z.string().url(),
        is_app_template: z.boolean().default(false),
      },
      annotations: {
        title: 'Generate Pack Template From URL (Admin)',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
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
