/**
 * Admin tools.
 *
 * All tools here use the admin Treaty client (`agent.api.admin`) which sends
 * the admin JWT minted by `admin_login` (or supplied via `X-PackRat-Admin-Token`).
 * Errors with status 401/403 are surfaced with `requiresAdmin: true` so the
 * caller gets a clear message about needing to authenticate as admin.
 */

import { z } from 'zod';
import { call } from '../client';
import type { AgentContext } from '../types';

const ADMIN = { requiresAdmin: true as const };

export function registerAdminTools(agent: AgentContext): void {
  // ── Stats / users / packs / catalog ───────────────────────────────────────

  agent.registerAdminTool(
    'admin_stats',
    {
      description: 'Get high-level platform stats: user, pack, and catalog counts.',
      inputSchema: {},
    },
    async () => call(agent.api.admin.admin.stats.get(), { action: 'fetch admin stats', ...ADMIN }),
  );

  agent.registerAdminTool(
    'admin_list_users',
    {
      description: 'Search/list users (paginated). Use `q` to filter by email or name.',
      inputSchema: {
        q: z.string().optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
      },
    },
    async ({ q, limit, offset }) =>
      call(agent.api.admin.admin['users-list'].get({ query: { q, limit, offset } }), {
        action: 'list users',
        ...ADMIN,
      }),
  );

  agent.registerAdminTool(
    'admin_hard_delete_user',
    {
      description:
        'GDPR-style hard-delete of a user. Irrevocable. Requires a non-empty `reason` for the audit log.',
      inputSchema: { user_id: z.string(), reason: z.string().min(1) },
    },
    async ({ user_id, reason }) =>
      call(agent.api.admin.admin.users({ id: user_id }).hard.delete({ reason }), {
        action: 'hard-delete user',
        resourceHint: `user ${user_id}`,
        ...ADMIN,
      }),
  );

  agent.registerAdminTool(
    'admin_list_packs',
    {
      description: 'Search/list packs across all users (admin view).',
      inputSchema: {
        q: z.string().optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
        include_deleted: z.boolean().default(false),
      },
    },
    async ({ q, limit, offset, include_deleted }) =>
      call(
        agent.api.admin.admin['packs-list'].get({
          query: { q, limit, offset, includeDeleted: include_deleted },
        }),
        { action: 'list packs (admin)', ...ADMIN },
      ),
  );

  agent.registerAdminTool(
    'admin_delete_pack',
    {
      description: 'Soft-delete a pack as admin (bypasses ownership).',
      inputSchema: { pack_id: z.string() },
    },
    async ({ pack_id }) =>
      call(agent.api.admin.admin.packs({ id: pack_id }).delete(), {
        action: 'admin delete pack',
        resourceHint: `pack ${pack_id}`,
        ...ADMIN,
      }),
  );

  agent.registerAdminTool(
    'admin_list_catalog',
    {
      description: 'Search/list catalog items across the platform.',
      inputSchema: {
        q: z.string().optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
      },
    },
    async ({ q, limit, offset }) =>
      call(agent.api.admin.admin['catalog-list'].get({ query: { q, limit, offset } }), {
        action: 'list catalog (admin)',
        ...ADMIN,
      }),
  );

  agent.registerAdminTool(
    'admin_update_catalog_item',
    {
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

  agent.registerAdminTool(
    'admin_delete_catalog_item',
    {
      description: 'Delete a catalog item as admin.',
      inputSchema: { item_id: z.union([z.string(), z.number()]) },
    },
    async ({ item_id }) =>
      call(agent.api.admin.admin.catalog({ id: String(item_id) }).delete(), {
        action: 'admin delete catalog item',
        resourceHint: `catalog item ${item_id}`,
        ...ADMIN,
      }),
  );

  // ── Trails (admin) ────────────────────────────────────────────────────────

  agent.registerAdminTool(
    'admin_search_trails',
    {
      description: 'Search OSM trails by name/sport (admin view).',
      inputSchema: {
        q: z.string().min(1),
        sport: z.string().optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
      },
    },
    async ({ q, sport, limit, offset }) =>
      call(agent.api.admin.admin.trails.search.get({ query: { q, sport, limit, offset } }), {
        action: 'admin search trails',
        ...ADMIN,
      }),
  );

  agent.registerAdminTool(
    'admin_get_trail',
    {
      description: 'Get a trail by OSM relation ID (admin).',
      inputSchema: { osm_id: z.string() },
    },
    async ({ osm_id }) =>
      call(agent.api.admin.admin.trails({ osmId: osm_id }).get(), {
        action: 'admin get trail',
        resourceHint: `trail ${osm_id}`,
        ...ADMIN,
      }),
  );

  agent.registerAdminTool(
    'admin_get_trail_geometry',
    {
      description: 'Get full GeoJSON geometry for a trail (admin).',
      inputSchema: { osm_id: z.string() },
    },
    async ({ osm_id }) =>
      call(agent.api.admin.admin.trails({ osmId: osm_id }).geometry.get(), {
        action: 'admin get trail geometry',
        resourceHint: `trail ${osm_id}`,
        ...ADMIN,
      }),
  );

  agent.registerAdminTool(
    'admin_list_trail_condition_reports',
    {
      description: 'List trail condition reports across all users (admin).',
      inputSchema: {
        q: z.string().optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
        include_deleted: z.boolean().default(false),
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

  agent.registerAdminTool(
    'admin_delete_trail_condition_report',
    {
      description: 'Soft-delete a trail condition report as admin.',
      inputSchema: { report_id: z.string() },
    },
    async ({ report_id }) =>
      call(agent.api.admin.admin.trails.conditions({ reportId: report_id }).delete(), {
        action: 'admin delete trail report',
        resourceHint: `report ${report_id}`,
        ...ADMIN,
      }),
  );

  // ── Analytics: platform ───────────────────────────────────────────────────

  agent.registerAdminTool(
    'admin_analytics_growth',
    {
      description: 'Platform user/pack growth metrics.',
      inputSchema: {
        period: z.enum(['day', 'week', 'month']).optional(),
        range: z.number().int().min(1).optional(),
      },
    },
    async ({ period, range }) =>
      call(agent.api.admin.admin.analytics.platform.growth.get({ query: { period, range } }), {
        action: 'admin analytics growth',
        ...ADMIN,
      }),
  );

  agent.registerAdminTool(
    'admin_analytics_activity',
    {
      description: 'Platform activity metrics over a time period.',
      inputSchema: {
        period: z.enum(['day', 'week', 'month']).optional(),
        range: z.number().int().min(1).optional(),
      },
    },
    async ({ period, range }) =>
      call(agent.api.admin.admin.analytics.platform.activity.get({ query: { period, range } }), {
        action: 'admin analytics activity',
        ...ADMIN,
      }),
  );

  agent.registerAdminTool(
    'admin_analytics_active_users',
    {
      description: 'Daily/weekly/monthly active user counts.',
      inputSchema: {},
    },
    async () =>
      call(agent.api.admin.admin.analytics.platform['active-users'].get(), {
        action: 'admin analytics active users',
        ...ADMIN,
      }),
  );

  agent.registerAdminTool(
    'admin_analytics_pack_breakdown',
    {
      description: 'Distribution of packs by category.',
      inputSchema: {},
    },
    async () =>
      call(agent.api.admin.admin.analytics.platform.breakdown.get(), {
        action: 'admin analytics breakdown',
        ...ADMIN,
      }),
  );

  // ── Analytics: catalog ────────────────────────────────────────────────────

  agent.registerAdminTool(
    'admin_analytics_catalog_overview',
    {
      description: 'Catalog-wide overview: item count, brands, price ranges, embedding coverage.',
      inputSchema: {},
    },
    async () =>
      call(agent.api.admin.admin.analytics.catalog.overview.get(), {
        action: 'admin catalog overview',
        ...ADMIN,
      }),
  );

  agent.registerAdminTool(
    'admin_analytics_top_brands',
    {
      description: 'Top gear brands in the catalog by item count.',
      inputSchema: { limit: z.number().int().min(1).max(200).default(20) },
    },
    async ({ limit }) =>
      call(agent.api.admin.admin.analytics.catalog.brands.get({ query: { limit } }), {
        action: 'admin catalog brands',
        ...ADMIN,
      }),
  );

  agent.registerAdminTool(
    'admin_analytics_catalog_prices',
    {
      description: 'Price distribution across the catalog.',
      inputSchema: {},
    },
    async () =>
      call(agent.api.admin.admin.analytics.catalog.prices.get(), {
        action: 'admin catalog prices',
        ...ADMIN,
      }),
  );

  agent.registerAdminTool(
    'admin_analytics_catalog_embeddings',
    {
      description: 'Catalog embedding coverage stats.',
      inputSchema: {},
    },
    async () =>
      call(agent.api.admin.admin.analytics.catalog.embeddings.get(), {
        action: 'admin catalog embedding stats',
        ...ADMIN,
      }),
  );

  agent.registerAdminTool(
    'admin_analytics_etl_jobs',
    {
      description: 'Recent ETL pipeline jobs.',
      inputSchema: { limit: z.number().int().min(1).max(200).default(20) },
    },
    async ({ limit }) =>
      call(agent.api.admin.admin.analytics.catalog.etl.get({ query: { limit } }), {
        action: 'admin ETL jobs',
        ...ADMIN,
      }),
  );

  agent.registerAdminTool(
    'admin_analytics_etl_failure_summary',
    {
      description: 'Top recent ETL failure patterns.',
      inputSchema: { limit: z.number().int().min(1).max(50).default(10) },
    },
    async ({ limit }) =>
      call(
        agent.api.admin.admin.analytics.catalog.etl['failure-summary'].get({ query: { limit } }),
        { action: 'admin ETL failure summary', ...ADMIN },
      ),
  );

  agent.registerAdminTool(
    'admin_analytics_etl_job_failures',
    {
      description: 'Per-job ETL failure drill-down.',
      inputSchema: {
        job_id: z.string(),
        limit: z.number().int().min(1).max(200).default(50),
      },
    },
    async ({ job_id, limit }) =>
      call(
        agent.api.admin.admin.analytics.catalog.etl({ jobId: job_id }).failures.get({
          query: { limit },
        }),
        { action: 'admin ETL job failures', resourceHint: `job ${job_id}`, ...ADMIN },
      ),
  );

  agent.registerAdminTool(
    'admin_etl_reset_stuck',
    {
      description: 'Mark stuck-running ETL jobs as failed (admin maintenance).',
      inputSchema: {},
    },
    async () =>
      call(agent.api.admin.admin.analytics.catalog.etl['reset-stuck'].post({}), {
        action: 'admin ETL reset stuck',
        ...ADMIN,
      }),
  );

  agent.registerAdminTool(
    'admin_etl_retry_job',
    {
      description: 'Retry a specific failed ETL job.',
      inputSchema: { job_id: z.string() },
    },
    async ({ job_id }) =>
      call(agent.api.admin.admin.analytics.catalog.etl({ jobId: job_id }).retry.post({}), {
        action: 'admin ETL retry job',
        resourceHint: `job ${job_id}`,
        ...ADMIN,
      }),
  );
}
