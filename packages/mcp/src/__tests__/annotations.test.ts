/**
 * Catalog test for U7: every registered tool must carry the connector-store
 * annotations Anthropic enforces, the `packrat_` namespace prefix, and a
 * scope classification consistent with the U5 model.
 *
 * Why a catalog test rather than per-file assertions?
 *
 *   - Anthropic rejects ~30% of connector submissions for missing tool
 *     annotations (per the U7 plan). A single test that walks every
 *     registered tool fails the build the instant a tool ships without
 *     the required annotations — no quiet drift.
 *
 *   - The `packrat_` prefix is the collision-prevention contract documented
 *     in the U7 "Key Technical Decisions". The test asserts every tool
 *     starts with `packrat_` so a typo or a forgotten rename surfaces
 *     loudly.
 *
 *   - Defaults are dangerous: the MCP SDK's `destructiveHint` default is
 *     `true`. A read-only tool that forgets to set `readOnlyHint: true`
 *     will still appear safe to Claude (because reads default to
 *     destructive-false elsewhere), but a write tool that forgets
 *     `destructiveHint: false` will quietly trigger a confirmation
 *     prompt on every call. We assert *both* are set explicitly.
 *
 *   - The scope classification is the U5 contract; the spot-check below
 *     keeps U7's rename honest against U5's gating, so a future rename
 *     can't accidentally move a tool out of the bucket the API enforces.
 *
 * Test strategy:
 *   - Instantiate a real `McpServer` with no transport. `registerTool` is
 *     a pure registration call; transport is only needed for `connect()`.
 *   - Build a stub `AgentContext` whose `api` is a `Proxy` that resolves
 *     any property chain into a no-op async function returning
 *     `{ data: {}, error: null, status: 200 }`. This satisfies every Eden
 *     Treaty call-chain in the tool files without standing up a real API.
 *   - Call every `registerXTools(agent)` function from `tools/*.ts` and
 *     reach into `server._registeredTools` to enumerate the catalog.
 *   - Assert per-tool annotation invariants + the named-tool coverage spot
 *     check listed in the U7 plan.
 *
 * If the SDK changes the shape of `_registeredTools`, this test is the
 * canary — it will fail loudly and direct the maintainer to the new
 * accessor.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';
import { classifyTool } from '../scopes';
import { registerAdminTools } from '../tools/admin';
import { registerAiTools } from '../tools/ai';
import { registerAlltrailsTools } from '../tools/alltrails';
import { registerAuthTools } from '../tools/auth';
import { registerCatalogTools } from '../tools/catalog';
import { registerFeedTools } from '../tools/feed';
import { registerGuidesTools } from '../tools/guides';
import { registerKnowledgeTools } from '../tools/knowledge';
import { registerPackTools } from '../tools/packs';
import { registerPackTemplateTools } from '../tools/packTemplates';
import { registerSeasonTools } from '../tools/seasons';
import { registerTrailConditionTools } from '../tools/trail-conditions';
import { registerTrailTools } from '../tools/trails';
import { registerTripTools } from '../tools/trips';
import { registerUploadTools } from '../tools/upload';
import { registerUserTools } from '../tools/user';
import { registerWeatherTools } from '../tools/weather';
import { registerWildlifeTools } from '../tools/wildlife';
import type { AgentContext } from '../types';

// ── Stub agent + tool registry ────────────────────────────────────────────────

/**
 * Build a `Proxy` whose every property access returns another proxy, and
 * whose every call returns a resolved Treaty-shaped result. Tool handlers
 * never run during registration (they're stored, not invoked), so this
 * just needs to satisfy TypeScript's "the property exists" check at
 * import time. The eden Treaty type machinery is structurally typed, so
 * `unknown as ApiClient` plus the proxy is sufficient.
 */
function makeApiStub(): unknown {
  const handler: ProxyHandler<() => unknown> = {
    get: (_target, prop) => {
      if (prop === 'then') return undefined; // never resolve as a thenable
      return makeApiStub();
    },
    apply: () => Promise.resolve({ data: {}, error: null, status: 200 }),
  };
  return new Proxy(() => undefined, handler);
}

function makeAgent(): { agent: AgentContext; server: McpServer } {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  const apiStub = makeApiStub() as AgentContext['api'];
  const agent: AgentContext = {
    server,
    api: apiStub,
    apiBaseUrl: 'https://api.test',
    setFeatureFlag: () => {
      /* no-op */
    },
    registerFlaggedTool: (_flag, ...args) => {
      // safe-cast: registerTool's overload union collapses at runtime
      return (server.registerTool as (...a: unknown[]) => ReturnType<typeof server.registerTool>)(
        ...args,
      );
    },
  };
  return { agent, server };
}

/**
 * Pull the internal registered-tool map. The SDK doesn't export a public
 * accessor; we accept the coupling because the alternative (a bespoke
 * registration proxy mirroring index.ts's) would duplicate logic and miss
 * tools added directly via `server.registerTool`. If the SDK renames this
 * field in a future bump, this test fails first — which is the desired
 * canary behaviour.
 */
function getRegisteredTools(server: McpServer): Record<
  string,
  {
    title?: string;
    annotations?: {
      title?: string;
      readOnlyHint?: boolean;
      destructiveHint?: boolean;
      idempotentHint?: boolean;
      openWorldHint?: boolean;
    };
    enabled: boolean;
  }
> {
  // The SDK keeps `_registeredTools` private but it's the canonical
  // accessor for tests — the catalog walk is what we need here.
  const internal = server as unknown as { _registeredTools: Record<string, unknown> };
  return internal._registeredTools as ReturnType<typeof getRegisteredTools>;
}

// ── Register every tool surface in one server (matches PackRatMCP.init) ──────

function buildCatalog(): {
  toolNames: string[];
  tools: ReturnType<typeof getRegisteredTools>;
} {
  const { agent, server } = makeAgent();
  registerAuthTools(agent);
  registerUserTools(agent);
  registerPackTools(agent);
  registerPackTemplateTools(agent);
  registerCatalogTools(agent);
  registerTripTools(agent);
  registerWeatherTools(agent);
  registerKnowledgeTools(agent);
  registerTrailConditionTools(agent);
  registerTrailTools(agent);
  registerFeedTools(agent);
  registerSeasonTools(agent);
  registerWildlifeTools(agent);
  registerAlltrailsTools(agent);
  registerUploadTools(agent);
  registerGuidesTools(agent);
  registerAiTools(agent);
  registerAdminTools(agent);

  const tools = getRegisteredTools(server);
  return { toolNames: Object.keys(tools), tools };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('U7 tool annotation catalog', () => {
  const { toolNames, tools } = buildCatalog();

  // Sanity guard: the catalog walk must find tools — otherwise the test
  // would silently pass with zero assertions if `_registeredTools` changed
  // shape. Verify a sensible minimum.
  it('registers a non-empty tool catalog', () => {
    expect(toolNames.length).toBeGreaterThan(80);
  });

  it.each(toolNames)('tool %s has the packrat_ namespace prefix', (name) => {
    expect(name).toMatch(/^packrat_/);
  });

  it.each(toolNames)('tool %s has an annotations object', (name) => {
    const tool = tools[name];
    expect(tool, `${name}: tool record missing`).toBeDefined();
    expect(tool.annotations, `${name}: annotations missing`).toBeDefined();
  });

  it.each(toolNames)('tool %s has a non-empty title ≤ 64 chars', (name) => {
    const ann = tools[name].annotations;
    expect(ann?.title, `${name}: annotation title missing`).toBeDefined();
    const title = ann?.title ?? '';
    expect(title.length).toBeGreaterThan(0);
    expect(title.length).toBeLessThanOrEqual(64);
  });

  it.each(toolNames)('tool %s has readOnlyHint set explicitly as a boolean', (name) => {
    const ann = tools[name].annotations;
    expect(typeof ann?.readOnlyHint, `${name}: readOnlyHint not boolean`).toBe('boolean');
  });

  it.each(toolNames)('tool %s has idempotentHint set explicitly as a boolean', (name) => {
    const ann = tools[name].annotations;
    expect(typeof ann?.idempotentHint, `${name}: idempotentHint not boolean`).toBe('boolean');
  });

  it.each(toolNames)('tool %s has openWorldHint set explicitly as a boolean', (name) => {
    const ann = tools[name].annotations;
    expect(typeof ann?.openWorldHint, `${name}: openWorldHint not boolean`).toBe('boolean');
  });

  it.each(
    toolNames,
  )('tool %s sets destructiveHint when readOnlyHint=false (avoids SDK default of true)', (name) => {
    const ann = tools[name].annotations;
    if (ann?.readOnlyHint === false) {
      expect(typeof ann?.destructiveHint, `${name}: destructiveHint not boolean`).toBe('boolean');
    }
  });
});

describe('U7 named-tool coverage (spot-check)', () => {
  const { tools } = buildCatalog();
  const expected = [
    'packrat_whoami',
    'packrat_get_pack',
    'packrat_list_packs',
    'packrat_create_pack',
    'packrat_delete_pack',
    'packrat_create_trip',
    'packrat_get_weather',
    'packrat_web_search',
    'packrat_admin_stats',
    'packrat_admin_hard_delete_user',
    'packrat_execute_sql_query',
    'packrat_get_database_schema',
    'packrat_create_pack_template',
    'packrat_create_app_pack_template',
    'packrat_generate_pack_template_from_url',
    'packrat_preview_alltrails_url',
  ];

  it.each(expected)('%s is registered', (name) => {
    expect(tools[name], `expected tool ${name} not in registry`).toBeDefined();
  });

  it('packrat_admin_hard_delete_user is annotated as destructive', () => {
    const ann = tools['packrat_admin_hard_delete_user']?.annotations;
    expect(ann?.readOnlyHint).toBe(false);
    expect(ann?.destructiveHint).toBe(true);
  });

  it('packrat_get_pack is annotated as read-only and closed-world', () => {
    const ann = tools['packrat_get_pack']?.annotations;
    expect(ann?.readOnlyHint).toBe(true);
    expect(ann?.openWorldHint).toBe(false);
  });

  it('packrat_web_search is annotated as read-only and open-world', () => {
    const ann = tools['packrat_web_search']?.annotations;
    expect(ann?.readOnlyHint).toBe(true);
    expect(ann?.openWorldHint).toBe(true);
  });

  it('packrat_get_weather is annotated as read-only and open-world (live data)', () => {
    const ann = tools['packrat_get_weather']?.annotations;
    expect(ann?.readOnlyHint).toBe(true);
    expect(ann?.openWorldHint).toBe(true);
  });

  it('packrat_preview_alltrails_url is annotated as read-only and open-world', () => {
    const ann = tools['packrat_preview_alltrails_url']?.annotations;
    expect(ann?.readOnlyHint).toBe(true);
    expect(ann?.openWorldHint).toBe(true);
  });

  it('packrat_create_pack_template no longer takes an is_app_template parameter', () => {
    // U7 split tool: user-level create has the parameter removed (now
    // hardcoded to false in the handler). The admin variant lives at
    // packrat_create_app_pack_template. We assert by inspecting the
    // recorded inputSchema's keys.
    const tool = tools['packrat_create_pack_template'] as unknown as {
      inputSchema?: { _def?: { shape?: () => Record<string, unknown> } };
    };
    const shape = tool.inputSchema?._def?.shape?.() ?? {};
    expect(Object.keys(shape)).not.toContain('is_app_template');
  });
});

describe('U7 scope-classification spot-check (cross-checks U5)', () => {
  // Per the U5 contract, every renamed tool must still classify
  // consistently with the API-side gating. Spot-check the representative
  // tools called out in the U7 plan, plus the new U7 split + EXPLICIT_ADMIN
  // additions.
  it.each([
    ['packrat_get_pack', 'read'],
    ['packrat_list_packs', 'read'],
    ['packrat_whoami', 'read'],
    ['packrat_search_trails', 'read'],
    ['packrat_create_trip', 'write'],
    ['packrat_update_pack', 'write'],
    ['packrat_delete_pack', 'write'],
    ['packrat_create_pack_template', 'write'],
    ['packrat_admin_stats', 'admin'],
    ['packrat_admin_hard_delete_user', 'admin'],
    ['packrat_execute_sql_query', 'admin'],
    ['packrat_get_database_schema', 'admin'],
    ['packrat_generate_pack_template_from_url', 'admin'],
    ['packrat_create_app_pack_template', 'admin'],
  ] as const)('%s classifies as %s', (name, expected) => {
    expect(classifyTool(name)).toBe(expected);
  });
});
