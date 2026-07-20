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
import { call, errResponse, nowIso } from '../client';
import { type ConfirmReason, confirmAction } from '../elicit';
import { ItemCategory, PackCategory } from '../enums';
import { audit, createLogger } from '../observability';
import { tool } from '../registerTool';
import type { AgentContext } from '../types';

/**
 * Structured error envelope for elicitation failures on the two
 * destructive/high-blast-radius template tools. Mirrors the helper of the
 * same name in `tools/admin.ts`; duplicated rather than centralised to
 * keep both files independently grep-able and avoid a circular-import
 * risk from `client.ts → elicit.ts → client.ts` if we hoisted it to
 * `client.ts`.
 */
function elicitFailureResponse(reason: ConfirmReason) {
  switch (reason) {
    case 'cancelled':
      return errResponse({
        code: 'user_cancelled',
        message: 'Action cancelled — confirmation not provided',
        retryable: false,
      });
    case 'mismatch':
      return errResponse({
        code: 'confirmation_mismatch',
        message: 'Action cancelled — the confirmation text did not match',
        retryable: false,
      });
    case 'timeout':
      return errResponse({
        code: 'confirmation_timeout',
        message: 'Confirmation prompt timed out before the user responded',
        retryable: true,
      });
    case 'unsupported':
      return errResponse({
        code: 'elicitation_unsupported',
        message: 'This tool requires user confirmation, which your MCP client does not support',
        retryable: false,
      });
  }
}

/**
 * U15: per-template-tool audit context. Mirrors the helper of the same
 * name in `tools/admin.ts` (intentionally duplicated for the same
 * grep-ability reasons documented on `elicitFailureResponse` above).
 */
function auditCtxFor(agent: AgentContext): {
  logger: ReturnType<typeof createLogger>;
  actor: { userId: string; scopes: readonly string[] };
} {
  const ctx = agent.getAuditContext?.() ?? { userId: '', scopes: [], correlationId: '' };
  return {
    logger: createLogger({ correlationId: ctx.correlationId }),
    actor: { userId: ctx.userId, scopes: ctx.scopes },
  };
}

function auditElicitDeclined(reason: ConfirmReason): { code: string; retryable: boolean } {
  switch (reason) {
    case 'cancelled':
      return { code: 'user_cancelled', retryable: false };
    case 'mismatch':
      return { code: 'confirmation_mismatch', retryable: false };
    case 'timeout':
      return { code: 'confirmation_timeout', retryable: true };
    case 'unsupported':
      return { code: 'elicitation_unsupported', retryable: false };
  }
}

// Structural subset of `McpToolResult` (client.ts) that `auditOutcome` reads.
// Mirrors the post-SDK-1.29 shape: `isError` is `boolean`, `structuredContent`
// is an open record. The error envelope is always written by `errResponse` /
// `errMessage`, so the cast below is safe.
type ToolResult = {
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
};

function auditOutcome(result: ToolResult): {
  outcome: 'success' | 'failure';
  error?: { code: string; retryable: boolean };
} {
  if (result.isError === true) {
    const e = result.structuredContent?.error as { code: string; retryable: boolean } | undefined;
    return e
      ? { outcome: 'failure', error: { code: e.code, retryable: e.retryable } }
      : { outcome: 'failure' };
  }
  return { outcome: 'success' };
}

export function registerPackTemplateTools(agent: AgentContext): void {
  // ── Templates ─────────────────────────────────────────────────────────────

  tool<Record<string, never>>(
    agent.server,
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
    async () =>
      call({ promise: agent.api.user['pack-templates'].get(), action: 'list pack templates' }),
  );

  tool<{ template_id: string }>(
    agent.server,
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
      call({
        promise: agent.api.user['pack-templates']({ templateId: template_id }).get(),
        action: 'get pack template',
        resourceHint: `template ${template_id}`,
      }),
  );

  // ── Create pack template (user-level) ─────────────────────────────────────
  // `is_app_template` is forced to `false` here; the admin variant lives in
  // `packrat_create_app_pack_template` below.

  tool<{
    name: string;
    description?: string;
    category: PackCategory;
    image?: string;
    tags?: string[];
  }>(
    agent.server,
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
      return call({
        promise: agent.api.user['pack-templates'].post({
          id: crypto.randomUUID(),
          name,
          description,
          category,
          image,
          tags,
          isAppTemplate: false,
          localCreatedAt: now,
          localUpdatedAt: now,
        }),
        action: 'create pack template',
      });
    },
  );

  // ── Create app pack template (admin-only) ────────────────────────────────
  // Same surface as `packrat_create_pack_template` but `is_app_template` is
  // forced to `true`. Admin-gated via the `create_app_pack_template` entry
  // in `EXPLICIT_ADMIN` in `scopes.ts` (the tool doesn't carry the
  // `admin_` prefix so the prefix-based classifier can't pick it up).

  tool<{
    name: string;
    description?: string;
    category: PackCategory;
    image?: string;
    tags?: string[];
  }>(
    agent.server,
    'packrat_create_app_pack_template',
    {
      title: 'Create App Pack Template (Admin)',
      description:
        'Create a curated app-level pack template visible to all users. Admin-only — requires the mcp:admin OAuth scope. Prompts for confirmation before creating (visible to every PackRat user). For personal templates use packrat_create_pack_template.',
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
    async ({ name, description, category, image, tags }, extra) => {
      const { logger, actor } = auditCtxFor(agent);
      // Target is the template name (no id yet — pre-create). The model can
      // re-derive the created id from the response if it cares.
      const target = { type: 'app_pack_template', id: name };
      const confirm = await confirmAction({
        agent,
        extra,
        opts: {
          message:
            `Confirm publish of app-wide pack template "${name}". ` +
            `This is visible to every PackRat user and not easily unpublished. ` +
            `Type PUBLISH to proceed:`,
          expectedConfirmation: 'PUBLISH',
        },
      });
      if (!confirm.confirmed) {
        audit({
          logger,
          action: 'create_app_pack_template',
          fields: {
            actor,
            target,
            outcome: 'declined',
            error: auditElicitDeclined(confirm.reason),
          },
        });
        return elicitFailureResponse(confirm.reason);
      }
      const now = nowIso();
      const result = await call({
        promise: agent.api.user['pack-templates'].post({
          id: crypto.randomUUID(),
          name,
          description,
          category,
          image,
          tags,
          isAppTemplate: true,
          localCreatedAt: now,
          localUpdatedAt: now,
        }),
        action: 'create app pack template',
        requiresAdmin: true,
      });
      audit({
        logger,
        action: 'create_app_pack_template',
        fields: { actor, target, ...auditOutcome(result) },
      });
      return result;
    },
  );

  tool<{
    template_id: string;
    name?: string;
    description?: string;
    category?: PackCategory;
    image?: string;
    tags?: string[];
  }>(
    agent.server,
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
    async ({ template_id, name, description, category, image, tags }) =>
      call({
        // The API's PUT is a full-replace: description/image/tags are required
        // (nullable). Map unset optional inputs to null; name/category stay
        // optional. Builds a typed literal so Eden validates the body shape.
        promise: agent.api.user['pack-templates']({ templateId: template_id }).put({
          ...(name !== undefined ? { name } : {}),
          ...(category !== undefined ? { category } : {}),
          description: description ?? null,
          image: image ?? null,
          tags: tags ?? null,
          localUpdatedAt: nowIso(),
        }),
        action: 'update pack template',
        resourceHint: `template ${template_id}`,
      }),
  );

  tool<{ template_id: string }>(
    agent.server,
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
      call({
        promise: agent.api.user['pack-templates']({ templateId: template_id }).delete(),
        action: 'delete pack template',
        resourceHint: `template ${template_id}`,
      }),
  );

  // ── Template items ────────────────────────────────────────────────────────

  tool<{ template_id: string }>(
    agent.server,
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
      call({
        promise: agent.api.user['pack-templates']({ templateId: template_id }).items.get(),
        action: 'list pack template items',
        resourceHint: `template ${template_id}`,
      }),
  );

  tool<{
    template_id: string;
    name: string;
    description?: string;
    weight: number;
    weight_unit: 'g' | 'oz' | 'kg' | 'lb';
    quantity: number;
    category: ItemCategory;
    consumable: boolean;
    worn: boolean;
    image?: string;
    notes?: string;
  }>(
    agent.server,
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
      call({
        promise: agent.api.user['pack-templates']({ templateId: template_id }).items.post({
          id: crypto.randomUUID(),
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
        action: 'add template item',
        resourceHint: `template ${template_id}`,
      }),
  );

  tool<{
    item_id: string;
    name?: string;
    description?: string;
    weight?: number;
    weight_unit?: 'g' | 'oz' | 'kg' | 'lb';
    quantity?: number;
    category?: ItemCategory;
    consumable?: boolean;
    worn?: boolean;
    image?: string;
    notes?: string;
  }>(
    agent.server,
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
      return call({
        promise: agent.api.user['pack-templates'].items({ itemId: item_id }).patch(body),
        action: 'update template item',
        resourceHint: `item ${item_id}`,
      });
    },
  );

  tool<{ item_id: string }>(
    agent.server,
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
      call({
        promise: agent.api.user['pack-templates'].items({ itemId: item_id }).delete(),
        action: 'delete template item',
        resourceHint: `item ${item_id}`,
      }),
  );

  // ── Generate from online content (admin-only on the API side) ─────────────
  // U7 adds this tool to EXPLICIT_ADMIN in scopes.ts so the MCP-level
  // surface matches what the API enforces — non-admin OAuth sessions don't
  // see it in tools/list.

  tool<{ content_url: string; is_app_template: boolean }>(
    agent.server,
    'packrat_generate_pack_template_from_url',
    {
      title: 'Generate Pack Template From URL (Admin)',
      description:
        'Generate a pack template from a TikTok or YouTube link. Admin-only — requires the mcp:admin OAuth scope; the server also gates this on the authenticated user having role ADMIN. Prompts for confirmation before fetching and processing the URL content.',
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
    async ({ content_url, is_app_template }, extra) => {
      const { logger, actor } = auditCtxFor(agent);
      // Target is the URL — bounded by the schema's `z.string().url()` and
      // already known to the operator from the rest of the audit context.
      // We deliberately do NOT log the LLM-fetched body or any derived
      // template fields.
      const target = { type: 'pack_template_source', id: content_url };
      const confirm = await confirmAction({
        agent,
        extra,
        opts: {
          message:
            `Confirm generate template from ${content_url}. ` +
            `${is_app_template ? '(App-wide template — visible to every user.) ' : ''}` +
            `The fetched content will be processed by an LLM and the resulting template will be created. ` +
            `Type GENERATE to proceed:`,
          expectedConfirmation: 'GENERATE',
        },
      });
      if (!confirm.confirmed) {
        audit({
          logger,
          action: 'generate_pack_template_from_url',
          fields: {
            actor,
            target,
            outcome: 'declined',
            error: auditElicitDeclined(confirm.reason),
          },
        });
        return elicitFailureResponse(confirm.reason);
      }
      const result = await call({
        promise: agent.api.user['pack-templates']['generate-from-online-content'].post({
          contentUrl: content_url,
          isAppTemplate: is_app_template,
        }),
        action: 'generate pack template from URL',
        requiresAdmin: true,
      });
      audit({
        logger,
        action: 'generate_pack_template_from_url',
        fields: {
          actor,
          target,
          ...auditOutcome(result),
        },
      });
      return result;
    },
  );
}
