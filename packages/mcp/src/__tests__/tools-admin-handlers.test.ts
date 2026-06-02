/**
 * Handler-coverage tests for the read-only / list / analytics / get / search /
 * update / etl admin tools.
 *
 * `tools-admin.test.ts` already exercises the four elicitation-gated
 * destructive tools (hard_delete_user, delete_pack, delete_catalog_item,
 * delete_trail_condition_report). Those are intentionally NOT re-tested here.
 *
 * Every other tool registered by `registerAdminTools` is a single
 * `call({ promise: agent.api.admin.admin.<...>.<verb>(...) })` whose handler
 * was never invoked, leaving the surrounding `call(...)` plumbing, query
 * marshalling and (for update_catalog_item) the partial-body builder
 * uncovered. Each test below invokes the real handler against the shared
 * api-recording stub and asserts:
 *
 *   1. The tool returns a text content block with non-empty text.
 *   2. The expected Treaty endpoint was hit — identified by the recorded
 *      property chain ending in the right path segments + terminal HTTP verb.
 *
 * The api stub resolves every verb to `{ success: true }`, so the `call(...)`
 * helper serialises that into a text block (the success path), which is what
 * we assert on.
 */

import { describe, expect, it } from 'vitest';
import { registerAdminTools } from '../tools/admin';
import { type ApiCall, firstText, getToolHandler, makeAgent, makeExtra } from './_tool-harness';

/** Safely read the structured error envelope from an isError result. */
function errorEnvelope(structured: Record<string, unknown> | undefined): {
  code?: unknown;
  retryable?: unknown;
} {
  return (structured?.error ?? {}) as { code?: unknown; retryable?: unknown };
}

/**
 * Find a recorded call whose property chain ends with `segments` (the last
 * element being the terminal HTTP verb). The proxy records non-verb calls
 * (e.g. `trails({osmId})`) with a synthetic `()` segment appended to the
 * returned chain, so we match on a trailing-suffix rather than the full path.
 */
function findCall(calls: readonly ApiCall[], segments: readonly string[]): ApiCall | undefined {
  return calls.find((c) => {
    if (c.path.length < segments.length) return false;
    const tail = c.path.slice(c.path.length - segments.length);
    return tail.every((seg, i) => seg === segments[i]);
  });
}

/**
 * Register the admin tools, invoke `name` with `args`, and assert both the
 * text-content contract and that a Treaty call ending in `segments` fired.
 */
async function expectAdminCall(opts: {
  name: string;
  args: Record<string, unknown>;
  segments: readonly string[];
}): Promise<void> {
  const { agent, server, calls } = makeAgent();
  registerAdminTools(agent);
  const result = await getToolHandler(server, opts.name)(opts.args, makeExtra());

  expect(result.content[0]?.type).toBe('text');
  expect(firstText(result).length).toBeGreaterThan(0);

  const hit = findCall(calls, opts.segments);
  expect(hit?.path.at(-1)).toBe(opts.segments.at(-1));
}

describe('admin read/list/analytics/get/search/update/etl handlers', () => {
  it('packrat_admin_stats → admin.stats.get', async () => {
    await expectAdminCall({
      name: 'packrat_admin_stats',
      args: {},
      segments: ['stats', 'get'],
    });
  });

  it('packrat_admin_list_users → admin.users-list.get', async () => {
    await expectAdminCall({
      name: 'packrat_admin_list_users',
      args: { q: 'ada', limit: 10, offset: 0 },
      segments: ['users-list', 'get'],
    });
  });

  it('packrat_admin_list_packs → admin.packs-list.get', async () => {
    await expectAdminCall({
      name: 'packrat_admin_list_packs',
      args: { limit: 20, offset: 0, include_deleted: false },
      segments: ['packs-list', 'get'],
    });
  });

  it('packrat_admin_list_catalog → admin.catalog-list.get', async () => {
    await expectAdminCall({
      name: 'packrat_admin_list_catalog',
      args: { limit: 20, offset: 0 },
      segments: ['catalog-list', 'get'],
    });
  });

  it('packrat_admin_update_catalog_item → admin.catalog({id}).patch', async () => {
    const { agent, server, calls } = makeAgent();
    registerAdminTools(agent);
    const result = await getToolHandler(server, 'packrat_admin_update_catalog_item')(
      { item_id: 42, name: 'Tarp', weight: 250, weight_unit: 'g', price: 99 },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);

    const patch = findCall(calls, ['catalog', '()', 'patch']);
    expect(patch?.path.at(-1)).toBe('patch');
    // The partial-body builder maps weight_unit → weightUnit and drops undefined fields.
    expect(patch?.args[0]).toEqual({ name: 'Tarp', weight: 250, weightUnit: 'g', price: 99 });
  });

  it('packrat_admin_search_trails → admin.trails.search.get', async () => {
    await expectAdminCall({
      name: 'packrat_admin_search_trails',
      args: { q: 'ridge', sport: 'hiking', limit: 10, offset: 0 },
      segments: ['trails', 'search', 'get'],
    });
  });

  it('packrat_admin_get_trail → admin.trails({osmId}).get', async () => {
    await expectAdminCall({
      name: 'packrat_admin_get_trail',
      args: { osm_id: 'rel/123' },
      segments: ['trails', '()', 'get'],
    });
  });

  it('packrat_admin_get_trail_geometry → admin.trails({osmId}).geometry.get', async () => {
    await expectAdminCall({
      name: 'packrat_admin_get_trail_geometry',
      args: { osm_id: 'rel/123' },
      segments: ['trails', '()', 'geometry', 'get'],
    });
  });

  it('packrat_admin_list_trail_condition_reports → admin.trails.conditions.get', async () => {
    await expectAdminCall({
      name: 'packrat_admin_list_trail_condition_reports',
      args: { limit: 20, offset: 0, include_deleted: false },
      segments: ['trails', 'conditions', 'get'],
    });
  });

  it('packrat_admin_analytics_growth → admin.analytics.platform.growth.get', async () => {
    await expectAdminCall({
      name: 'packrat_admin_analytics_growth',
      args: { period: 'week', range: 12 },
      segments: ['analytics', 'platform', 'growth', 'get'],
    });
  });

  it('packrat_admin_analytics_activity → admin.analytics.platform.activity.get', async () => {
    await expectAdminCall({
      name: 'packrat_admin_analytics_activity',
      args: { period: 'day', range: 7 },
      segments: ['analytics', 'platform', 'activity', 'get'],
    });
  });

  it('packrat_admin_analytics_active_users → admin.analytics.platform.active-users.get', async () => {
    await expectAdminCall({
      name: 'packrat_admin_analytics_active_users',
      args: {},
      segments: ['analytics', 'platform', 'active-users', 'get'],
    });
  });

  it('packrat_admin_analytics_pack_breakdown → admin.analytics.platform.breakdown.get', async () => {
    await expectAdminCall({
      name: 'packrat_admin_analytics_pack_breakdown',
      args: {},
      segments: ['analytics', 'platform', 'breakdown', 'get'],
    });
  });

  it('packrat_admin_analytics_catalog_overview → admin.analytics.catalog.overview.get', async () => {
    await expectAdminCall({
      name: 'packrat_admin_analytics_catalog_overview',
      args: {},
      segments: ['analytics', 'catalog', 'overview', 'get'],
    });
  });

  it('packrat_admin_analytics_top_brands → admin.analytics.catalog.brands.get', async () => {
    await expectAdminCall({
      name: 'packrat_admin_analytics_top_brands',
      args: { limit: 25 },
      segments: ['analytics', 'catalog', 'brands', 'get'],
    });
  });

  it('packrat_admin_analytics_catalog_prices → admin.analytics.catalog.prices.get', async () => {
    await expectAdminCall({
      name: 'packrat_admin_analytics_catalog_prices',
      args: {},
      segments: ['analytics', 'catalog', 'prices', 'get'],
    });
  });

  it('packrat_admin_analytics_catalog_embeddings → admin.analytics.catalog.embeddings.get', async () => {
    await expectAdminCall({
      name: 'packrat_admin_analytics_catalog_embeddings',
      args: {},
      segments: ['analytics', 'catalog', 'embeddings', 'get'],
    });
  });

  it('packrat_admin_analytics_etl_jobs → admin.analytics.catalog.etl.get', async () => {
    await expectAdminCall({
      name: 'packrat_admin_analytics_etl_jobs',
      args: { limit: 50 },
      segments: ['catalog', 'etl', 'get'],
    });
  });

  it('packrat_admin_analytics_etl_failure_summary → admin.analytics.catalog.etl.failure-summary.get', async () => {
    await expectAdminCall({
      name: 'packrat_admin_analytics_etl_failure_summary',
      args: { limit: 50 },
      segments: ['etl', 'failure-summary', 'get'],
    });
  });

  it('packrat_admin_analytics_etl_job_failures → admin.analytics.catalog.etl({jobId}).failures.get', async () => {
    await expectAdminCall({
      name: 'packrat_admin_analytics_etl_job_failures',
      args: { job_id: 'job-7', limit: 50 },
      segments: ['etl', '()', 'failures', 'get'],
    });
  });

  it('packrat_admin_etl_reset_stuck → admin.analytics.catalog.etl.reset-stuck.post', async () => {
    await expectAdminCall({
      name: 'packrat_admin_etl_reset_stuck',
      args: {},
      segments: ['etl', 'reset-stuck', 'post'],
    });
  });

  it('packrat_admin_etl_retry_job → admin.analytics.catalog.etl({jobId}).retry.post', async () => {
    await expectAdminCall({
      name: 'packrat_admin_etl_retry_job',
      args: { job_id: 'job-7' },
      segments: ['etl', '()', 'retry', 'post'],
    });
  });
});

/**
 * Optional-omitted invocations: call each tool with ONLY its required args so
 * the `if (x !== undefined)` / `?? default` false branches run. For
 * update_catalog_item we additionally assert the recorded PATCH body omits
 * every optional key (the body-builder skips `undefined` fields).
 */
describe('admin handlers — optional args omitted (false/default branches)', () => {
  it('packrat_admin_list_users with only required pagination → users-list.get', async () => {
    // `q` omitted → the `query.q` is `undefined`, exercising the optional-omitted path.
    await expectAdminCall({
      name: 'packrat_admin_list_users',
      args: { limit: 10, offset: 0 },
      segments: ['users-list', 'get'],
    });
  });

  it('packrat_admin_list_packs with q omitted → packs-list.get', async () => {
    await expectAdminCall({
      name: 'packrat_admin_list_packs',
      args: { limit: 20, offset: 0, include_deleted: false },
      segments: ['packs-list', 'get'],
    });
  });

  it('packrat_admin_list_catalog with q omitted → catalog-list.get', async () => {
    await expectAdminCall({
      name: 'packrat_admin_list_catalog',
      args: { limit: 20, offset: 0 },
      segments: ['catalog-list', 'get'],
    });
  });

  it('packrat_admin_search_trails with sport omitted → trails.search.get', async () => {
    await expectAdminCall({
      name: 'packrat_admin_search_trails',
      args: { q: 'ridge', limit: 10, offset: 0 },
      segments: ['trails', 'search', 'get'],
    });
  });

  it('packrat_admin_list_trail_condition_reports with q omitted → trails.conditions.get', async () => {
    await expectAdminCall({
      name: 'packrat_admin_list_trail_condition_reports',
      args: { limit: 20, offset: 0, include_deleted: false },
      segments: ['trails', 'conditions', 'get'],
    });
  });

  it('packrat_admin_analytics_growth with period/range omitted → growth.get', async () => {
    await expectAdminCall({
      name: 'packrat_admin_analytics_growth',
      args: {},
      segments: ['analytics', 'platform', 'growth', 'get'],
    });
  });

  it('packrat_admin_analytics_activity with period/range omitted → activity.get', async () => {
    await expectAdminCall({
      name: 'packrat_admin_analytics_activity',
      args: {},
      segments: ['analytics', 'platform', 'activity', 'get'],
    });
  });

  it('packrat_admin_update_catalog_item with all optionals omitted → empty PATCH body', async () => {
    const { agent, server, calls } = makeAgent();
    registerAdminTools(agent);
    // Only the required `item_id`; every optional field is omitted so each
    // `if (x !== undefined)` guard in the body-builder takes its false arm.
    const result = await getToolHandler(server, 'packrat_admin_update_catalog_item')(
      { item_id: 7 },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);

    const patch = findCall(calls, ['catalog', '()', 'patch']);
    expect(patch?.path.at(-1)).toBe('patch');
    // No optional fields supplied → the partial body is empty.
    expect(patch?.args[0]).toEqual({});
  });

  it('packrat_admin_update_catalog_item with a single optional → body carries only that key', async () => {
    const { agent, server, calls } = makeAgent();
    registerAdminTools(agent);
    // Supply only `brand`; every other `if (x !== undefined)` guard is false.
    const result = await getToolHandler(server, 'packrat_admin_update_catalog_item')(
      { item_id: 'sku-9', brand: 'Acme' },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);

    const patch = findCall(calls, ['catalog', '()', 'patch']);
    expect(patch?.args[0]).toEqual({ brand: 'Acme' });
  });

  it('packrat_admin_update_catalog_item with categories + description → both keys present', async () => {
    const { agent, server, calls } = makeAgent();
    registerAdminTools(agent);
    // `categories` and `description` exercise the remaining `if (x !== undefined)`
    // true arms of the body-builder not hit elsewhere.
    const result = await getToolHandler(server, 'packrat_admin_update_catalog_item')(
      { item_id: 9, categories: ['shelter', 'tarp'], description: 'Ultralight tarp' },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);

    const patch = findCall(calls, ['catalog', '()', 'patch']);
    expect(patch?.args[0]).toEqual({
      categories: ['shelter', 'tarp'],
      description: 'Ultralight tarp',
    });
  });
});

/**
 * Error-path invocations: drive the `call(...)` failure branch via the
 * `apiFail` api stub (every verb resolves to a 500 error envelope). The
 * handler must return `isError: true` with a string error code in the
 * structured envelope. We cover one read GET tool and the update PATCH tool.
 */
describe('admin handlers — API error path (call failure branch)', () => {
  async function expectAdminError(opts: {
    name: string;
    args: Record<string, unknown>;
  }): Promise<void> {
    const { agent, server } = makeAgent({ apiFail: true });
    registerAdminTools(agent);
    const result = await getToolHandler(server, opts.name)(opts.args, makeExtra());

    expect(result.isError).toBe(true);
    const code = errorEnvelope(result.structuredContent).code;
    expect(typeof code).toBe('string');
    expect((code as string).length).toBeGreaterThan(0);
    // A 500 envelope maps to the retryable `api_error` code (client.ts).
    expect(code).toBe('api_error');
  }

  it('packrat_admin_stats surfaces an error envelope on a 500', async () => {
    await expectAdminError({ name: 'packrat_admin_stats', args: {} });
  });

  it('packrat_admin_list_users surfaces an error envelope on a 500', async () => {
    await expectAdminError({
      name: 'packrat_admin_list_users',
      args: { limit: 10, offset: 0 },
    });
  });

  it('packrat_admin_update_catalog_item surfaces an error envelope on a 500', async () => {
    await expectAdminError({
      name: 'packrat_admin_update_catalog_item',
      args: { item_id: 5, name: 'X' },
    });
  });
});

/**
 * Destructive-tool branches the non-destructive handler tests can't reach:
 * the `timeout` arms of `elicitFailureResponse` (admin.ts:68-73) and
 * `auditElicitDeclined` (admin.ts:154-155), plus the `auditOutcome` failure
 * branch (admin.ts:137-142) which only runs when a *confirmed* destructive
 * action then hits an API error. `tools-admin.test.ts` already covers the
 * happy/cancel/mismatch/unsupported paths; these fill the remaining arms.
 */
describe('admin destructive handlers — timeout + post-confirm failure branches', () => {
  it('hard_delete_user: elicitation timeout → confirmation_timeout (retryable)', async () => {
    // `confirmAction` classifies this message as `reason: 'timeout'`, driving
    // both the `auditElicitDeclined` and `elicitFailureResponse` timeout arms.
    const { agent, server, calls } = makeAgent({
      reject: new Error('Elicitation request timed out'),
    });
    registerAdminTools(agent);
    const result = await getToolHandler(server, 'packrat_admin_hard_delete_user')(
      { user_id: 'user-42', reason: 'GDPR request' },
      makeExtra(),
    );

    expect(result.isError).toBe(true);
    expect(errorEnvelope(result.structuredContent).code).toBe('confirmation_timeout');
    expect(errorEnvelope(result.structuredContent).retryable).toBe(true);
    // Timed-out confirmation must suppress the DELETE.
    expect(calls.filter((c) => c.path.at(-1) === 'delete')).toHaveLength(0);
  });

  it('delete_pack: elicitation timeout → confirmation_timeout', async () => {
    const { agent, server, calls } = makeAgent({
      reject: new Error('Elicitation request timed out'),
    });
    registerAdminTools(agent);
    const result = await getToolHandler(server, 'packrat_admin_delete_pack')(
      { pack_id: 'pack-7' },
      makeExtra(),
    );

    expect(errorEnvelope(result.structuredContent).code).toBe('confirmation_timeout');
    expect(calls.filter((c) => c.path.at(-1) === 'delete')).toHaveLength(0);
  });

  it('hard_delete_user: confirmed then API 500 → failure outcome with error envelope', async () => {
    // Accept + matching confirmation fires the DELETE, but `apiFail` makes it
    // 500 — exercising `auditOutcome`'s `result.isError === true` branch and
    // the `error ? ... : ...` ternary's truthy arm (the error envelope is
    // always present, so the falsy arm is unreachable — see report).
    const { agent, server, calls } = makeAgent({
      resolve: { action: 'accept', content: { confirmation: 'user-42' } },
      apiFail: true,
    });
    // Supply a real audit context so `auditCtxFor` takes the present arm of
    // `agent.getAuditContext?.()` (admin.ts:100) rather than the empty default.
    agent.getAuditContext = () => ({
      userId: 'admin-1',
      scopes: ['mcp:admin'],
      correlationId: 'session:test',
    });
    registerAdminTools(agent);
    const result = await getToolHandler(server, 'packrat_admin_hard_delete_user')(
      { user_id: 'user-42', reason: 'GDPR request' },
      makeExtra(),
    );

    expect(result.isError).toBe(true);
    expect(errorEnvelope(result.structuredContent).code).toBe('api_error');
    // The confirmed DELETE did fire (then failed upstream).
    expect(calls.filter((c) => c.path.at(-1) === 'delete')).toHaveLength(1);
  });
});
