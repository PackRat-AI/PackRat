/**
 * Admin tools.
 *
 * All tools here use the admin Treaty client (`agent.api.admin`) which sends
 * the Better Auth bearer; the API enforces admin-only access by inspecting
 * `user.role === 'ADMIN'` (the U5 extension to `adminAuthGuard`). Errors
 * with status 401/403 are surfaced with `requiresAdmin: true` so the caller
 * gets a clear message about needing to be signed in as an admin.
 *
 * U5 visibility: admin tools register as ordinary `agent.server.registerTool`
 * calls. The PackRatMCP `init()` post-pass disables any tool whose
 * `visibleScopesForTool(name)` doesn't intersect the granted OAuth scopes,
 * so a non-admin session never sees these in `tools/list` even though they
 * were registered.
 *
 * U7 renamed every tool to the `packrat_admin_*` shape and added explicit
 * tool annotations (title, readOnlyHint, destructiveHint, idempotentHint,
 * openWorldHint). The classifier in `scopes.ts` accepts both the
 * pre-rename `admin_*` and post-rename `packrat_admin_*` shapes.
 */

import { z } from 'zod';
import { call, clampLimit, errResponse, ok, PAGINATION_LIMIT_MAX } from '../client';
import { type ConfirmReason, confirmAction } from '../elicit';
import { audit, createLogger, type Logger } from '../observability';
import {
  AdminActiveUsersOutputSchema,
  AdminAnalyticsActivityOutputSchema,
  AdminAnalyticsGrowthOutputSchema,
  AdminAnalyticsPackBreakdownOutputSchema,
  AdminCatalogOverviewOutputSchema,
  AdminStatsOutputSchema,
} from '../output-schemas';
import { tool } from '../registerTool';
import type { AgentContext } from '../types';

/**
 * U10: map a `confirmAction` failure reason into the canonical structured-
 * error envelope. Kept here (not in `elicit.ts`) so the helper module
 * stays free of `errResponse` coupling and remains usable from tests
 * that don't want the `McpToolResult` shape.
 *
 * Error codes:
 *   - `user_cancelled`         → user declined / cancelled the prompt.
 *   - `confirmation_mismatch`  → user accepted but typed the wrong string.
 *   - `confirmation_timeout`   → SDK's 60s elicitation timeout fired.
 *   - `elicitation_unsupported` → client never advertised the capability,
 *     no live transport, or some other unrecoverable surface issue.
 *
 * `retryable` is set to `true` only for timeout — the user might answer
 * faster on the next try. Mismatch / cancelled / unsupported are all
 * "do not retry without changing something" states.
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

const ADMIN = { requiresAdmin: true as const };

/**
 * U15: build a `{ logger, actor, correlationId }` triple from the agent's
 * per-session audit context, falling back to an empty actor when the
 * agent doesn't expose one (test stubs / legacy bearer flow).
 *
 * Exposed as a tiny helper so each admin tool's audit-line site reads
 * uniformly. Note that we read `getAuditContext` lazily inside each
 * tool handler (not at registration time) so per-invocation `props`
 * changes are picked up correctly.
 */
function auditCtxFor(agent: AgentContext): {
  logger: Logger;
  actor: { userId: string; scopes: readonly string[] };
  correlationId: string;
} {
  const ctx = agent.getAuditContext?.() ?? { userId: '', scopes: [], correlationId: '' };
  const logger = createLogger({ correlationId: ctx.correlationId });
  return {
    logger,
    actor: { userId: ctx.userId, scopes: ctx.scopes },
    correlationId: ctx.correlationId,
  };
}

/**
 * U15: audit-log shape for the destructive admin tools (delete, hard-
 * delete, publish app template, generate from URL). The error code is
 * the canonical U8 `errResponse` code; `retryable` is the same flag the
 * error envelope carries to the model.
 *
 * `outcome` discriminates:
 *   - `'success'`  — the side-effect ran and the API returned a 2xx.
 *   - `'failure'`  — the API returned a non-2xx; `error` carries the
 *                    canonical code/retryable surface.
 *   - `'declined'` — an elicitation surface returned `confirmed: false`
 *                    (user_cancelled, confirmation_mismatch, timeout,
 *                    elicitation_unsupported). The action did not run.
 */
type AuditOutcome = 'success' | 'failure' | 'declined';
// Structural subset of `McpToolResult` (client.ts) that `auditOutcome` reads.
// Mirrors the post-SDK-1.29 shape: `isError` is `boolean`, `structuredContent`
// is an open record. The error envelope is always written by `errResponse` /
// `errMessage`, so the cast below is safe.
type ToolResult = {
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
};

function auditOutcome(result: ToolResult): {
  outcome: AuditOutcome;
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

function auditElicitDeclined(reason: ConfirmReason): { code: string; retryable: boolean } {
  // Mirror the elicitFailureResponse mapping (kept close to the
  // failure-response helper above so they evolve in lockstep).
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

// U8: shorthand for the paginated-list `limit` schema with the
// connector-store cap baked into the description. The clamp happens
// server-side; the upper bound here is intentionally generous so a
// model that ignores the cap doesn't get a validation rejection on a
// recoverable mistake.
const PAGINATED_LIMIT_FIELD = z
  .number()
  .int()
  .min(1)
  .max(200)
  .default(PAGINATION_LIMIT_MAX)
  .describe(`Page size (clamped to ${PAGINATION_LIMIT_MAX} server-side).`);

const PAGINATED_OFFSET_FIELD = z
  .number()
  .int()
  .min(0)
  .default(0)
  .describe('Pagination offset; use `nextOffset` from the previous response.');

/**
 * Common annotation defaults for read-style admin tools (stats, list,
 * analytics drill-downs). Spread into the `annotations` object on each
 * tool to keep the per-tool surface short while still being explicit
 * about every flag.
 */
const READ_ADMIN_ANNOTATIONS = {
  readOnlyHint: true,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export function registerAdminTools(agent: AgentContext): void {
  // ── Stats / users / packs / catalog ───────────────────────────────────────

  tool<Record<string, never>>(
    agent.server,
    'packrat_admin_stats',
    {
      title: 'Admin: Platform Stats',
      description: 'Get high-level platform stats: user, pack, and catalog counts.',
      inputSchema: {},
      // U8: tier-1 structured output.
      outputSchema: AdminStatsOutputSchema.shape,
      annotations: { title: 'Admin: Platform Stats', ...READ_ADMIN_ANNOTATIONS },
    },
    async () =>
      call({
        promise: agent.api.admin.admin.stats.get(),
        action: 'fetch admin stats',
        structured: true,
        ...ADMIN,
      }),
  );

  tool<{ q?: string; limit: number; offset: number }>(
    agent.server,
    'packrat_admin_list_users',
    {
      title: 'Admin: List Users',
      description:
        `Search/list users (paginated). Use \`q\` to filter by email or name. ` +
        `Page size is capped at ${PAGINATION_LIMIT_MAX} server-side; the API returns ` +
        `a \`{ data, total, limit, offset }\` envelope which the model can walk via the next \`offset\`.`,
      inputSchema: {
        q: z.string().optional(),
        limit: PAGINATED_LIMIT_FIELD,
        offset: PAGINATED_OFFSET_FIELD,
      },
      annotations: { title: 'Admin: List Users', ...READ_ADMIN_ANNOTATIONS },
    },
    async ({ q, limit, offset }) =>
      call({
        promise: agent.api.admin.admin['users-list'].get({
          query: { q, limit: clampLimit({ value: limit }), offset },
        }),
        action: 'list users',
        ...ADMIN,
      }),
  );

  tool<{ user_id: string; reason: string }>(
    agent.server,
    'packrat_admin_hard_delete_user',
    {
      title: 'Admin: Hard-Delete User',
      description:
        'GDPR-style hard-delete of a user. Irrevocable. Requires a non-empty `reason` for the audit log. ' +
        'U10: prompts the user to retype the target user_id before proceeding.',
      inputSchema: { user_id: z.string(), reason: z.string().min(1) },
      annotations: {
        title: 'Admin: Hard-Delete User',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ user_id, reason }, extra) => {
      const { logger, actor } = auditCtxFor(agent);
      const target = { type: 'user', id: user_id };
      // U10: confirm before the irreversible side-effect. We require the
      // operator to retype the user_id verbatim. The admin API has no
      // GET-by-id endpoint to enrich the prompt with the username/email
      // pre-deletion (see `packages/api/src/routes/admin/index.ts` — only
      // `/users-list` and the DELETE exist). Keeping the prompt to "type
      // the id you passed" avoids an extra failable read while still
      // forcing a deliberate confirmation step.
      const confirm = await confirmAction({
        agent,
        extra,
        opts: {
          message:
            `Confirm hard-delete of user ${user_id}. ` +
            `Reason on record: "${reason}". ` +
            `This is irreversible (GDPR-style). ` +
            `Type the user id (${user_id}) to proceed:`,
          expectedConfirmation: user_id,
          fieldLabel: 'User ID',
        },
      });
      if (!confirm.confirmed) {
        audit({
          logger,
          action: 'admin_hard_delete_user',
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
        promise: agent.api.admin.admin.users({ id: user_id }).hard.delete({ reason }),
        action: 'hard-delete user',
        resourceHint: `user ${user_id}`,
        ...ADMIN,
      });
      audit({
        logger,
        action: 'admin_hard_delete_user',
        fields: { actor, target, ...auditOutcome(result) },
      });
      return result;
    },
  );

  tool<{ q?: string; limit: number; offset: number; include_deleted: boolean }>(
    agent.server,
    'packrat_admin_list_packs',
    {
      title: 'Admin: List Packs',
      description:
        `Search/list packs across all users (admin view). ` +
        `Page size is capped at ${PAGINATION_LIMIT_MAX} server-side; walk via the next \`offset\` field.`,
      inputSchema: {
        q: z.string().optional(),
        limit: PAGINATED_LIMIT_FIELD,
        offset: PAGINATED_OFFSET_FIELD,
        include_deleted: z.boolean().default(false),
      },
      annotations: { title: 'Admin: List Packs', ...READ_ADMIN_ANNOTATIONS },
    },
    async ({ q, limit, offset, include_deleted }) =>
      call({
        promise: agent.api.admin.admin['packs-list'].get({
          query: {
            q,
            limit: clampLimit({ value: limit }),
            offset,
            includeDeleted: include_deleted,
          },
        }),
        action: 'list packs (admin)',
        ...ADMIN,
      }),
  );

  tool<{ pack_id: string }>(
    agent.server,
    'packrat_admin_delete_pack',
    {
      title: 'Admin: Delete Pack',
      description:
        'Soft-delete a pack as admin (bypasses ownership). ' +
        'U10: prompts the user to type DELETE before proceeding.',
      inputSchema: { pack_id: z.string() },
      annotations: {
        title: 'Admin: Delete Pack',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ pack_id }, extra) => {
      const { logger, actor } = auditCtxFor(agent);
      const target = { type: 'pack', id: pack_id };
      const confirm = await confirmAction({
        agent,
        extra,
        opts: {
          message: `Confirm delete of pack ${pack_id}. Type DELETE to proceed:`,
          expectedConfirmation: 'DELETE',
        },
      });
      if (!confirm.confirmed) {
        audit({
          logger,
          action: 'admin_delete_pack',
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
        promise: agent.api.admin.admin.packs({ id: pack_id }).delete(),
        action: 'admin delete pack',
        resourceHint: `pack ${pack_id}`,
        ...ADMIN,
      });
      audit({
        logger,
        action: 'admin_delete_pack',
        fields: { actor, target, ...auditOutcome(result) },
      });
      return result;
    },
  );

  tool<{ q?: string; limit: number; offset: number }>(
    agent.server,
    'packrat_admin_list_catalog',
    {
      title: 'Admin: List Catalog Items',
      description:
        `Search/list catalog items across the platform. ` +
        `Page size is capped at ${PAGINATION_LIMIT_MAX} server-side; walk via the next \`offset\`.`,
      inputSchema: {
        q: z.string().optional(),
        limit: PAGINATED_LIMIT_FIELD,
        offset: PAGINATED_OFFSET_FIELD,
      },
      annotations: { title: 'Admin: List Catalog Items', ...READ_ADMIN_ANNOTATIONS },
    },
    async ({ q, limit, offset }) =>
      call({
        promise: agent.api.admin.admin['catalog-list'].get({
          query: { q, limit: clampLimit({ value: limit }), offset },
        }),
        action: 'list catalog (admin)',
        ...ADMIN,
      }),
  );

  tool<{
    item_id: string | number;
    name?: string;
    brand?: string;
    categories?: string[];
    weight?: number;
    weight_unit?: 'g' | 'oz' | 'kg' | 'lb';
    price?: number;
    description?: string;
  }>(
    agent.server,
    'packrat_admin_update_catalog_item',
    {
      title: 'Admin: Update Catalog Item',
      description: 'Update a catalog item (name, brand, price, weight, etc.) as admin.',
      inputSchema: {
        item_id: z.union([z.string(), z.number()]),
        name: z.string().optional(),
        brand: z.string().optional(),
        categories: z.array(z.string()).optional(),
        weight: z.number().min(0).optional(),
        weight_unit: z.enum(['g', 'oz', 'kg', 'lb']).optional(),
        price: z.number().min(0).optional(),
        description: z.string().optional(),
      },
      annotations: {
        title: 'Admin: Update Catalog Item',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ item_id, name, brand, categories, weight, weight_unit, price, description }) => {
      const body: Record<string, unknown> = {};
      if (name !== undefined) body.name = name;
      if (brand !== undefined) body.brand = brand;
      if (categories !== undefined) body.categories = categories;
      if (weight !== undefined) body.weight = weight;
      if (weight_unit !== undefined) body.weightUnit = weight_unit;
      if (price !== undefined) body.price = price;
      if (description !== undefined) body.description = description;
      return call({
        promise: agent.api.admin.admin.catalog({ id: String(item_id) }).patch(body),
        action: 'admin update catalog item',
        resourceHint: `catalog item ${item_id}`,
        ...ADMIN,
      });
    },
  );

  tool<{ item_id: string | number }>(
    agent.server,
    'packrat_admin_delete_catalog_item',
    {
      title: 'Admin: Delete Catalog Item',
      description:
        'Delete a catalog item as admin. U10: prompts the user to type DELETE before proceeding.',
      inputSchema: { item_id: z.union([z.string(), z.number()]) },
      annotations: {
        title: 'Admin: Delete Catalog Item',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ item_id }, extra) => {
      const { logger, actor } = auditCtxFor(agent);
      const target = { type: 'catalog_item', id: String(item_id) };
      const confirm = await confirmAction({
        agent,
        extra,
        opts: {
          message: `Confirm delete of catalog item ${item_id}. Type DELETE to proceed:`,
          expectedConfirmation: 'DELETE',
        },
      });
      if (!confirm.confirmed) {
        audit({
          logger,
          action: 'admin_delete_catalog_item',
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
        promise: agent.api.admin.admin.catalog({ id: String(item_id) }).delete(),
        action: 'admin delete catalog item',
        resourceHint: `catalog item ${item_id}`,
        ...ADMIN,
      });
      audit({
        logger,
        action: 'admin_delete_catalog_item',
        fields: { actor, target, ...auditOutcome(result) },
      });
      return result;
    },
  );

  // ── Trails (admin) ────────────────────────────────────────────────────────

  tool<{ q: string; sport?: string; limit: number; offset: number }>(
    agent.server,
    'packrat_admin_search_trails',
    {
      title: 'Admin: Search Trails',
      description:
        `Search OSM trails by name/sport (admin view). ` +
        `Page size is capped at ${PAGINATION_LIMIT_MAX} server-side; the response carries an \`offset\` and a \`hasMore\` flag for continuation.`,
      inputSchema: {
        q: z.string().min(1),
        sport: z.string().optional(),
        limit: PAGINATED_LIMIT_FIELD,
        offset: PAGINATED_OFFSET_FIELD,
      },
      annotations: { title: 'Admin: Search Trails', ...READ_ADMIN_ANNOTATIONS },
    },
    async ({ q, sport, limit, offset }) =>
      call({
        promise: agent.api.admin.admin.trails.search.get({
          query: { q, sport, limit: clampLimit({ value: limit }), offset },
        }),
        action: 'admin search trails',
        ...ADMIN,
      }),
  );

  tool<{ osm_id: string }>(
    agent.server,
    'packrat_admin_get_trail',
    {
      title: 'Admin: Get Trail',
      description: 'Get a trail by OSM relation ID (admin).',
      inputSchema: { osm_id: z.string() },
      annotations: { title: 'Admin: Get Trail', ...READ_ADMIN_ANNOTATIONS },
    },
    async ({ osm_id }) =>
      call({
        promise: agent.api.admin.admin.trails({ osmId: osm_id }).get(),
        action: 'admin get trail',
        resourceHint: `trail ${osm_id}`,
        ...ADMIN,
      }),
  );

  tool<{ osm_id: string }>(
    agent.server,
    'packrat_admin_get_trail_geometry',
    {
      title: 'Admin: Get Trail Geometry',
      description: 'Get full GeoJSON geometry for a trail (admin).',
      inputSchema: { osm_id: z.string() },
      annotations: { title: 'Admin: Get Trail Geometry', ...READ_ADMIN_ANNOTATIONS },
    },
    async ({ osm_id }) =>
      call({
        promise: agent.api.admin.admin.trails({ osmId: osm_id }).geometry.get(),
        action: 'admin get trail geometry',
        resourceHint: `trail ${osm_id}`,
        ...ADMIN,
      }),
  );

  tool<{ q?: string; limit: number; offset: number; include_deleted: boolean }>(
    agent.server,
    'packrat_admin_list_trail_condition_reports',
    {
      title: 'Admin: List Trail Condition Reports',
      description:
        `List trail condition reports across all users (admin). ` +
        `Page size is capped at ${PAGINATION_LIMIT_MAX} server-side; walk via the next \`offset\`.`,
      inputSchema: {
        q: z.string().optional(),
        limit: PAGINATED_LIMIT_FIELD,
        offset: PAGINATED_OFFSET_FIELD,
        include_deleted: z.boolean().default(false),
      },
      annotations: {
        title: 'Admin: List Trail Condition Reports',
        ...READ_ADMIN_ANNOTATIONS,
      },
    },
    async ({ q, limit, offset, include_deleted }) =>
      call({
        promise: agent.api.admin.admin.trails.conditions.get({
          query: {
            q,
            limit: clampLimit({ value: limit }),
            offset,
            includeDeleted: include_deleted,
          },
        }),
        action: 'list trail condition reports (admin)',
        ...ADMIN,
      }),
  );

  tool<{ report_id: string }>(
    agent.server,
    'packrat_admin_delete_trail_condition_report',
    {
      title: 'Admin: Delete Trail Condition Report',
      description:
        'Soft-delete a trail condition report as admin. ' +
        'U10: prompts the user to type DELETE before proceeding.',
      inputSchema: { report_id: z.string() },
      annotations: {
        title: 'Admin: Delete Trail Condition Report',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ report_id }, extra) => {
      const { logger, actor } = auditCtxFor(agent);
      const target = { type: 'trail_condition_report', id: report_id };
      const confirm = await confirmAction({
        agent,
        extra,
        opts: {
          message: `Confirm delete of trail condition report ${report_id}. Type DELETE to proceed:`,
          expectedConfirmation: 'DELETE',
        },
      });
      if (!confirm.confirmed) {
        audit({
          logger,
          action: 'admin_delete_trail_condition_report',
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
        promise: agent.api.admin.admin.trails.conditions({ reportId: report_id }).delete(),
        action: 'admin delete trail report',
        resourceHint: `report ${report_id}`,
        ...ADMIN,
      });
      audit({
        logger,
        action: 'admin_delete_trail_condition_report',
        fields: {
          actor,
          target,
          ...auditOutcome(result),
        },
      });
      return result;
    },
  );

  // ── Analytics: platform ───────────────────────────────────────────────────

  tool<{ period?: 'day' | 'week' | 'month'; range?: number }>(
    agent.server,
    'packrat_admin_analytics_growth',
    {
      title: 'Admin: Analytics Growth',
      description: 'Platform user/pack growth metrics.',
      inputSchema: {
        period: z.enum(['day', 'week', 'month']).optional(),
        range: z.number().int().min(1).optional(),
      },
      // U8: tier-1 — array of growth points.
      outputSchema: { items: AdminAnalyticsGrowthOutputSchema },
      annotations: { title: 'Admin: Analytics Growth', ...READ_ADMIN_ANNOTATIONS },
    },
    async ({ period, range }) => {
      const result = await agent.api.admin.admin.analytics.platform.growth.get({
        query: { period, range },
      });
      if (result.error || result.data == null) {
        return call({
          promise: Promise.resolve(result),
          action: 'admin analytics growth',
          ...ADMIN,
        });
      }
      return ok({ data: { items: result.data }, structured: true });
    },
  );

  tool<{ period?: 'day' | 'week' | 'month'; range?: number }>(
    agent.server,
    'packrat_admin_analytics_activity',
    {
      title: 'Admin: Analytics Activity',
      description: 'Platform activity metrics over a time period.',
      inputSchema: {
        period: z.enum(['day', 'week', 'month']).optional(),
        range: z.number().int().min(1).optional(),
      },
      // U8: tier-1 — array of activity points.
      outputSchema: { items: AdminAnalyticsActivityOutputSchema },
      annotations: { title: 'Admin: Analytics Activity', ...READ_ADMIN_ANNOTATIONS },
    },
    async ({ period, range }) => {
      const result = await agent.api.admin.admin.analytics.platform.activity.get({
        query: { period, range },
      });
      if (result.error || result.data == null) {
        return call({
          promise: Promise.resolve(result),
          action: 'admin analytics activity',
          ...ADMIN,
        });
      }
      return ok({ data: { items: result.data }, structured: true });
    },
  );

  tool<Record<string, never>>(
    agent.server,
    'packrat_admin_analytics_active_users',
    {
      title: 'Admin: Active Users',
      description: 'Daily/weekly/monthly active user counts.',
      inputSchema: {},
      // U8: tier-1 — { dau, wau, mau }.
      outputSchema: AdminActiveUsersOutputSchema.shape,
      annotations: { title: 'Admin: Active Users', ...READ_ADMIN_ANNOTATIONS },
    },
    async () =>
      call({
        promise: agent.api.admin.admin.analytics.platform['active-users'].get(),
        action: 'admin analytics active users',
        structured: true,
        ...ADMIN,
      }),
  );

  tool<Record<string, never>>(
    agent.server,
    'packrat_admin_analytics_pack_breakdown',
    {
      title: 'Admin: Pack Breakdown',
      description: 'Distribution of packs by category.',
      inputSchema: {},
      // U8: tier-1 — array of { category, count }.
      outputSchema: { items: AdminAnalyticsPackBreakdownOutputSchema },
      annotations: { title: 'Admin: Pack Breakdown', ...READ_ADMIN_ANNOTATIONS },
    },
    async () => {
      const result = await agent.api.admin.admin.analytics.platform.breakdown.get();
      if (result.error || result.data == null) {
        return call({
          promise: Promise.resolve(result),
          action: 'admin analytics breakdown',
          ...ADMIN,
        });
      }
      return ok({ data: { items: result.data }, structured: true });
    },
  );

  // ── Analytics: catalog ────────────────────────────────────────────────────

  tool<Record<string, never>>(
    agent.server,
    'packrat_admin_analytics_catalog_overview',
    {
      title: 'Admin: Catalog Overview',
      description: 'Catalog-wide overview: item count, brands, price ranges, embedding coverage.',
      inputSchema: {},
      // U8: tier-1 — full CatalogOverview shape.
      outputSchema: AdminCatalogOverviewOutputSchema.shape,
      annotations: { title: 'Admin: Catalog Overview', ...READ_ADMIN_ANNOTATIONS },
    },
    async () =>
      call({
        promise: agent.api.admin.admin.analytics.catalog.overview.get(),
        action: 'admin catalog overview',
        structured: true,
        ...ADMIN,
      }),
  );

  tool<{ limit: number }>(
    agent.server,
    'packrat_admin_analytics_top_brands',
    {
      title: 'Admin: Top Brands',
      description:
        `Top gear brands in the catalog by item count. ` +
        `Page size is capped at ${PAGINATION_LIMIT_MAX} server-side.`,
      inputSchema: { limit: PAGINATED_LIMIT_FIELD },
      annotations: { title: 'Admin: Top Brands', ...READ_ADMIN_ANNOTATIONS },
    },
    async ({ limit }) =>
      call({
        promise: agent.api.admin.admin.analytics.catalog.brands.get({
          query: { limit: clampLimit({ value: limit }) },
        }),
        action: 'admin catalog brands',
        ...ADMIN,
      }),
  );

  tool<Record<string, never>>(
    agent.server,
    'packrat_admin_analytics_catalog_prices',
    {
      title: 'Admin: Catalog Prices',
      description: 'Price distribution across the catalog.',
      inputSchema: {},
      annotations: { title: 'Admin: Catalog Prices', ...READ_ADMIN_ANNOTATIONS },
    },
    async () =>
      call({
        promise: agent.api.admin.admin.analytics.catalog.prices.get(),
        action: 'admin catalog prices',
        ...ADMIN,
      }),
  );

  tool<Record<string, never>>(
    agent.server,
    'packrat_admin_analytics_catalog_embeddings',
    {
      title: 'Admin: Catalog Embedding Stats',
      description: 'Catalog embedding coverage stats.',
      inputSchema: {},
      annotations: { title: 'Admin: Catalog Embedding Stats', ...READ_ADMIN_ANNOTATIONS },
    },
    async () =>
      call({
        promise: agent.api.admin.admin.analytics.catalog.embeddings.get(),
        action: 'admin catalog embedding stats',
        ...ADMIN,
      }),
  );

  tool<{ limit: number }>(
    agent.server,
    'packrat_admin_analytics_etl_jobs',
    {
      title: 'Admin: ETL Jobs',
      description:
        `Recent ETL pipeline jobs. ` +
        `Page size is capped at ${PAGINATION_LIMIT_MAX} server-side.`,
      inputSchema: { limit: PAGINATED_LIMIT_FIELD },
      annotations: { title: 'Admin: ETL Jobs', ...READ_ADMIN_ANNOTATIONS },
    },
    async ({ limit }) =>
      call({
        promise: agent.api.admin.admin.analytics.catalog.etl.get({
          query: { limit: clampLimit({ value: limit }) },
        }),
        action: 'admin ETL jobs',
        ...ADMIN,
      }),
  );

  tool<{ limit: number }>(
    agent.server,
    'packrat_admin_analytics_etl_failure_summary',
    {
      title: 'Admin: ETL Failure Summary',
      description:
        `Top recent ETL failure patterns. ` +
        `Page size is capped at ${PAGINATION_LIMIT_MAX} server-side.`,
      inputSchema: { limit: PAGINATED_LIMIT_FIELD },
      annotations: { title: 'Admin: ETL Failure Summary', ...READ_ADMIN_ANNOTATIONS },
    },
    async ({ limit }) =>
      call({
        promise: agent.api.admin.admin.analytics.catalog.etl['failure-summary'].get({
          query: { limit: clampLimit({ value: limit }) },
        }),
        action: 'admin ETL failure summary',
        ...ADMIN,
      }),
  );

  tool<{ job_id: string; limit: number }>(
    agent.server,
    'packrat_admin_analytics_etl_job_failures',
    {
      title: 'Admin: ETL Job Failures',
      description:
        `Per-job ETL failure drill-down. ` +
        `Page size is capped at ${PAGINATION_LIMIT_MAX} server-side.`,
      inputSchema: {
        job_id: z.string(),
        limit: PAGINATED_LIMIT_FIELD,
      },
      annotations: { title: 'Admin: ETL Job Failures', ...READ_ADMIN_ANNOTATIONS },
    },
    async ({ job_id, limit }) =>
      call({
        promise: agent.api.admin.admin.analytics.catalog.etl({ jobId: job_id }).failures.get({
          query: { limit: clampLimit({ value: limit }) },
        }),
        action: 'admin ETL job failures',
        resourceHint: `job ${job_id}`,
        ...ADMIN,
      }),
  );

  tool<Record<string, never>>(
    agent.server,
    'packrat_admin_etl_reset_stuck',
    {
      title: 'Admin: ETL Reset Stuck Jobs',
      description: 'Mark stuck-running ETL jobs as failed (admin maintenance).',
      inputSchema: {},
      annotations: {
        title: 'Admin: ETL Reset Stuck Jobs',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () =>
      call({
        promise: agent.api.admin.admin.analytics.catalog.etl['reset-stuck'].post({}),
        action: 'admin ETL reset stuck',
        ...ADMIN,
      }),
  );

  tool<{ job_id: string }>(
    agent.server,
    'packrat_admin_etl_retry_job',
    {
      title: 'Admin: ETL Retry Job',
      description: 'Retry a specific failed ETL job.',
      inputSchema: { job_id: z.string() },
      annotations: {
        title: 'Admin: ETL Retry Job',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ job_id }) =>
      call({
        promise: agent.api.admin.admin.analytics.catalog.etl({ jobId: job_id }).retry.post({}),
        action: 'admin ETL retry job',
        resourceHint: `job ${job_id}`,
        ...ADMIN,
      }),
  );
}
