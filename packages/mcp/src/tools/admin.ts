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
import { call } from '../client';
import type { AgentContext } from '../types';

const ADMIN = { requiresAdmin: true as const };

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

  agent.server.registerTool(
    'packrat_admin_stats',
    {
      title: 'Admin: Platform Stats',
      description: 'Get high-level platform stats: user, pack, and catalog counts.',
      inputSchema: {},
      annotations: { title: 'Admin: Platform Stats', ...READ_ADMIN_ANNOTATIONS },
    },
    async () => call(agent.api.admin.admin.stats.get(), { action: 'fetch admin stats', ...ADMIN }),
  );

  agent.server.registerTool(
    'packrat_admin_list_users',
    {
      title: 'Admin: List Users',
      description: 'Search/list users (paginated). Use `q` to filter by email or name.',
      inputSchema: {
        q: z.string().optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
      },
      annotations: { title: 'Admin: List Users', ...READ_ADMIN_ANNOTATIONS },
    },
    async ({ q, limit, offset }) =>
      call(agent.api.admin.admin['users-list'].get({ query: { q, limit, offset } }), {
        action: 'list users',
        ...ADMIN,
      }),
  );

  agent.server.registerTool(
    'packrat_admin_hard_delete_user',
    {
      title: 'Admin: Hard-Delete User',
      description:
        'GDPR-style hard-delete of a user. Irrevocable. Requires a non-empty `reason` for the audit log.',
      inputSchema: { user_id: z.string(), reason: z.string().min(1) },
      annotations: {
        title: 'Admin: Hard-Delete User',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ user_id, reason }) =>
      call(agent.api.admin.admin.users({ id: user_id }).hard.delete({ reason }), {
        action: 'hard-delete user',
        resourceHint: `user ${user_id}`,
        ...ADMIN,
      }),
  );

  agent.server.registerTool(
    'packrat_admin_list_packs',
    {
      title: 'Admin: List Packs',
      description: 'Search/list packs across all users (admin view).',
      inputSchema: {
        q: z.string().optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
        include_deleted: z.boolean().default(false),
      },
      annotations: { title: 'Admin: List Packs', ...READ_ADMIN_ANNOTATIONS },
    },
    async ({ q, limit, offset, include_deleted }) =>
      call(
        agent.api.admin.admin['packs-list'].get({
          query: { q, limit, offset, includeDeleted: include_deleted },
        }),
        { action: 'list packs (admin)', ...ADMIN },
      ),
  );

  agent.server.registerTool(
    'packrat_admin_delete_pack',
    {
      title: 'Admin: Delete Pack',
      description: 'Soft-delete a pack as admin (bypasses ownership).',
      inputSchema: { pack_id: z.string() },
      annotations: {
        title: 'Admin: Delete Pack',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ pack_id }) =>
      call(agent.api.admin.admin.packs({ id: pack_id }).delete(), {
        action: 'admin delete pack',
        resourceHint: `pack ${pack_id}`,
        ...ADMIN,
      }),
  );

  agent.server.registerTool(
    'packrat_admin_list_catalog',
    {
      title: 'Admin: List Catalog Items',
      description: 'Search/list catalog items across the platform.',
      inputSchema: {
        q: z.string().optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
      },
      annotations: { title: 'Admin: List Catalog Items', ...READ_ADMIN_ANNOTATIONS },
    },
    async ({ q, limit, offset }) =>
      call(agent.api.admin.admin['catalog-list'].get({ query: { q, limit, offset } }), {
        action: 'list catalog (admin)',
        ...ADMIN,
      }),
  );

  agent.server.registerTool(
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
      return call(agent.api.admin.admin.catalog({ id: String(item_id) }).patch(body), {
        action: 'admin update catalog item',
        resourceHint: `catalog item ${item_id}`,
        ...ADMIN,
      });
    },
  );

  agent.server.registerTool(
    'packrat_admin_delete_catalog_item',
    {
      title: 'Admin: Delete Catalog Item',
      description: 'Delete a catalog item as admin.',
      inputSchema: { item_id: z.union([z.string(), z.number()]) },
      annotations: {
        title: 'Admin: Delete Catalog Item',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ item_id }) =>
      call(agent.api.admin.admin.catalog({ id: String(item_id) }).delete(), {
        action: 'admin delete catalog item',
        resourceHint: `catalog item ${item_id}`,
        ...ADMIN,
      }),
  );

  // ── Trails (admin) ────────────────────────────────────────────────────────

  agent.server.registerTool(
    'packrat_admin_search_trails',
    {
      title: 'Admin: Search Trails',
      description: 'Search OSM trails by name/sport (admin view).',
      inputSchema: {
        q: z.string().min(1),
        sport: z.string().optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
      },
      annotations: { title: 'Admin: Search Trails', ...READ_ADMIN_ANNOTATIONS },
    },
    async ({ q, sport, limit, offset }) =>
      call(agent.api.admin.admin.trails.search.get({ query: { q, sport, limit, offset } }), {
        action: 'admin search trails',
        ...ADMIN,
      }),
  );

  agent.server.registerTool(
    'packrat_admin_get_trail',
    {
      title: 'Admin: Get Trail',
      description: 'Get a trail by OSM relation ID (admin).',
      inputSchema: { osm_id: z.string() },
      annotations: { title: 'Admin: Get Trail', ...READ_ADMIN_ANNOTATIONS },
    },
    async ({ osm_id }) =>
      call(agent.api.admin.admin.trails({ osmId: osm_id }).get(), {
        action: 'admin get trail',
        resourceHint: `trail ${osm_id}`,
        ...ADMIN,
      }),
  );

  agent.server.registerTool(
    'packrat_admin_get_trail_geometry',
    {
      title: 'Admin: Get Trail Geometry',
      description: 'Get full GeoJSON geometry for a trail (admin).',
      inputSchema: { osm_id: z.string() },
      annotations: { title: 'Admin: Get Trail Geometry', ...READ_ADMIN_ANNOTATIONS },
    },
    async ({ osm_id }) =>
      call(agent.api.admin.admin.trails({ osmId: osm_id }).geometry.get(), {
        action: 'admin get trail geometry',
        resourceHint: `trail ${osm_id}`,
        ...ADMIN,
      }),
  );

  agent.server.registerTool(
    'packrat_admin_list_trail_condition_reports',
    {
      title: 'Admin: List Trail Condition Reports',
      description: 'List trail condition reports across all users (admin).',
      inputSchema: {
        q: z.string().optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
        include_deleted: z.boolean().default(false),
      },
      annotations: {
        title: 'Admin: List Trail Condition Reports',
        ...READ_ADMIN_ANNOTATIONS,
      },
    },
    async ({ q, limit, offset, include_deleted }) =>
      call(
        agent.api.admin.admin.trails.conditions.get({
          query: { q, limit, offset, includeDeleted: include_deleted },
        }),
        { action: 'list trail condition reports (admin)', ...ADMIN },
      ),
  );

  agent.server.registerTool(
    'packrat_admin_delete_trail_condition_report',
    {
      title: 'Admin: Delete Trail Condition Report',
      description: 'Soft-delete a trail condition report as admin.',
      inputSchema: { report_id: z.string() },
      annotations: {
        title: 'Admin: Delete Trail Condition Report',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ report_id }) =>
      call(agent.api.admin.admin.trails.conditions({ reportId: report_id }).delete(), {
        action: 'admin delete trail report',
        resourceHint: `report ${report_id}`,
        ...ADMIN,
      }),
  );

  // ── Analytics: platform ───────────────────────────────────────────────────

  agent.server.registerTool(
    'packrat_admin_analytics_growth',
    {
      title: 'Admin: Analytics Growth',
      description: 'Platform user/pack growth metrics.',
      inputSchema: {
        period: z.enum(['day', 'week', 'month']).optional(),
        range: z.number().int().min(1).optional(),
      },
      annotations: { title: 'Admin: Analytics Growth', ...READ_ADMIN_ANNOTATIONS },
    },
    async ({ period, range }) =>
      call(agent.api.admin.admin.analytics.platform.growth.get({ query: { period, range } }), {
        action: 'admin analytics growth',
        ...ADMIN,
      }),
  );

  agent.server.registerTool(
    'packrat_admin_analytics_activity',
    {
      title: 'Admin: Analytics Activity',
      description: 'Platform activity metrics over a time period.',
      inputSchema: {
        period: z.enum(['day', 'week', 'month']).optional(),
        range: z.number().int().min(1).optional(),
      },
      annotations: { title: 'Admin: Analytics Activity', ...READ_ADMIN_ANNOTATIONS },
    },
    async ({ period, range }) =>
      call(agent.api.admin.admin.analytics.platform.activity.get({ query: { period, range } }), {
        action: 'admin analytics activity',
        ...ADMIN,
      }),
  );

  agent.server.registerTool(
    'packrat_admin_analytics_active_users',
    {
      title: 'Admin: Active Users',
      description: 'Daily/weekly/monthly active user counts.',
      inputSchema: {},
      annotations: { title: 'Admin: Active Users', ...READ_ADMIN_ANNOTATIONS },
    },
    async () =>
      call(agent.api.admin.admin.analytics.platform['active-users'].get(), {
        action: 'admin analytics active users',
        ...ADMIN,
      }),
  );

  agent.server.registerTool(
    'packrat_admin_analytics_pack_breakdown',
    {
      title: 'Admin: Pack Breakdown',
      description: 'Distribution of packs by category.',
      inputSchema: {},
      annotations: { title: 'Admin: Pack Breakdown', ...READ_ADMIN_ANNOTATIONS },
    },
    async () =>
      call(agent.api.admin.admin.analytics.platform.breakdown.get(), {
        action: 'admin analytics breakdown',
        ...ADMIN,
      }),
  );

  // ── Analytics: catalog ────────────────────────────────────────────────────

  agent.server.registerTool(
    'packrat_admin_analytics_catalog_overview',
    {
      title: 'Admin: Catalog Overview',
      description: 'Catalog-wide overview: item count, brands, price ranges, embedding coverage.',
      inputSchema: {},
      annotations: { title: 'Admin: Catalog Overview', ...READ_ADMIN_ANNOTATIONS },
    },
    async () =>
      call(agent.api.admin.admin.analytics.catalog.overview.get(), {
        action: 'admin catalog overview',
        ...ADMIN,
      }),
  );

  agent.server.registerTool(
    'packrat_admin_analytics_top_brands',
    {
      title: 'Admin: Top Brands',
      description: 'Top gear brands in the catalog by item count.',
      inputSchema: { limit: z.number().int().min(1).max(200).default(20) },
      annotations: { title: 'Admin: Top Brands', ...READ_ADMIN_ANNOTATIONS },
    },
    async ({ limit }) =>
      call(agent.api.admin.admin.analytics.catalog.brands.get({ query: { limit } }), {
        action: 'admin catalog brands',
        ...ADMIN,
      }),
  );

  agent.server.registerTool(
    'packrat_admin_analytics_catalog_prices',
    {
      title: 'Admin: Catalog Prices',
      description: 'Price distribution across the catalog.',
      inputSchema: {},
      annotations: { title: 'Admin: Catalog Prices', ...READ_ADMIN_ANNOTATIONS },
    },
    async () =>
      call(agent.api.admin.admin.analytics.catalog.prices.get(), {
        action: 'admin catalog prices',
        ...ADMIN,
      }),
  );

  agent.server.registerTool(
    'packrat_admin_analytics_catalog_embeddings',
    {
      title: 'Admin: Catalog Embedding Stats',
      description: 'Catalog embedding coverage stats.',
      inputSchema: {},
      annotations: { title: 'Admin: Catalog Embedding Stats', ...READ_ADMIN_ANNOTATIONS },
    },
    async () =>
      call(agent.api.admin.admin.analytics.catalog.embeddings.get(), {
        action: 'admin catalog embedding stats',
        ...ADMIN,
      }),
  );

  agent.server.registerTool(
    'packrat_admin_analytics_etl_jobs',
    {
      title: 'Admin: ETL Jobs',
      description: 'Recent ETL pipeline jobs.',
      inputSchema: { limit: z.number().int().min(1).max(200).default(20) },
      annotations: { title: 'Admin: ETL Jobs', ...READ_ADMIN_ANNOTATIONS },
    },
    async ({ limit }) =>
      call(agent.api.admin.admin.analytics.catalog.etl.get({ query: { limit } }), {
        action: 'admin ETL jobs',
        ...ADMIN,
      }),
  );

  agent.server.registerTool(
    'packrat_admin_analytics_etl_failure_summary',
    {
      title: 'Admin: ETL Failure Summary',
      description: 'Top recent ETL failure patterns.',
      inputSchema: { limit: z.number().int().min(1).max(50).default(10) },
      annotations: { title: 'Admin: ETL Failure Summary', ...READ_ADMIN_ANNOTATIONS },
    },
    async ({ limit }) =>
      call(
        agent.api.admin.admin.analytics.catalog.etl['failure-summary'].get({ query: { limit } }),
        { action: 'admin ETL failure summary', ...ADMIN },
      ),
  );

  agent.server.registerTool(
    'packrat_admin_analytics_etl_job_failures',
    {
      title: 'Admin: ETL Job Failures',
      description: 'Per-job ETL failure drill-down.',
      inputSchema: {
        job_id: z.string(),
        limit: z.number().int().min(1).max(200).default(50),
      },
      annotations: { title: 'Admin: ETL Job Failures', ...READ_ADMIN_ANNOTATIONS },
    },
    async ({ job_id, limit }) =>
      call(
        agent.api.admin.admin.analytics.catalog.etl({ jobId: job_id }).failures.get({
          query: { limit },
        }),
        { action: 'admin ETL job failures', resourceHint: `job ${job_id}`, ...ADMIN },
      ),
  );

  agent.server.registerTool(
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
      call(agent.api.admin.admin.analytics.catalog.etl['reset-stuck'].post({}), {
        action: 'admin ETL reset stuck',
        ...ADMIN,
      }),
  );

  agent.server.registerTool(
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
      call(agent.api.admin.admin.analytics.catalog.etl({ jobId: job_id }).retry.post({}), {
        action: 'admin ETL retry job',
        resourceHint: `job ${job_id}`,
        ...ADMIN,
      }),
  );
}
