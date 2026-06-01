/**
 * U8 — Output schema sanity tests.
 *
 * Each Tier-1 schema declared in `output-schemas.ts` is validated against a
 * representative sample of the upstream API's response shape. The goal is
 * to catch the most common regressions:
 *
 *  - A field rename in `@packrat/schemas` that breaks the MCP envelope.
 *  - A handler emitting `structuredContent` whose shape no longer matches
 *    the declared `outputSchema` — which the SDK would reject at runtime.
 *  - A field type change (string→number etc.) that loosens the contract
 *    without us noticing.
 *
 * Round-trip tests use `safeParse` so the failure mode is a useful list of
 * Zod issues, not just "threw".
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  AdminActiveUsersOutputSchema,
  AdminAnalyticsActivityOutputSchema,
  AdminAnalyticsGrowthOutputSchema,
  AdminAnalyticsPackBreakdownOutputSchema,
  AdminCatalogOverviewOutputSchema,
  AdminStatsOutputSchema,
  GetPackOutputSchema,
  GetTripOutputSchema,
  GetWeatherOutputSchema,
  ListPacksOutputSchema,
  ListTripsOutputSchema,
  paginatedWithNextOffset,
  WhoAmIOutputSchema,
} from '../output-schemas';
import { registerAdminTools } from '../tools/admin';
import { registerAuthTools } from '../tools/auth';
import { registerPackTools } from '../tools/packs';
import { registerTripTools } from '../tools/trips';
import { registerWeatherTools } from '../tools/weather';
import type { AgentContext } from '../types';

describe('U8 paginatedWithNextOffset helper', () => {
  const schema = paginatedWithNextOffset(z.object({ id: z.string() }));

  it('accepts a populated page with a numeric nextOffset', () => {
    const result = schema.safeParse({
      data: [{ id: 'a' }, { id: 'b' }],
      nextOffset: 25,
    });
    expect(result.success).toBe(true);
  });

  it('accepts an empty terminal page with nextOffset: null', () => {
    const result = schema.safeParse({ data: [], nextOffset: null });
    expect(result.success).toBe(true);
  });

  it('rejects a missing nextOffset field', () => {
    const result = schema.safeParse({ data: [] });
    expect(result.success).toBe(false);
  });

  it('rejects a negative nextOffset', () => {
    const result = schema.safeParse({ data: [], nextOffset: -1 });
    expect(result.success).toBe(false);
  });
});

describe('U8 WhoAmIOutputSchema', () => {
  it('accepts a representative profile response', () => {
    const result = WhoAmIOutputSchema.safeParse({
      success: true,
      user: {
        id: 'u_abc',
        email: 'a@example.com',
        firstName: 'Alice',
        lastName: null,
        role: 'USER',
        emailVerified: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing user field', () => {
    const result = WhoAmIOutputSchema.safeParse({ success: true });
    expect(result.success).toBe(false);
  });

  it('rejects a non-email email value', () => {
    const result = WhoAmIOutputSchema.safeParse({
      user: {
        id: 'u',
        email: 'not-an-email',
        firstName: null,
        lastName: null,
        role: 'USER',
        emailVerified: null,
        createdAt: null,
        updatedAt: null,
      },
    });
    expect(result.success).toBe(false);
  });
});

describe('U8 GetPackOutputSchema', () => {
  it('accepts a pack-with-items response', () => {
    const result = GetPackOutputSchema.safeParse({
      id: 'p_1',
      userId: 'u_1',
      name: 'My Pack',
      description: null,
      category: null,
      isPublic: false,
      image: null,
      tags: null,
      deleted: false,
      isAIGenerated: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      items: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects when items is missing (PackWithItems requires items)', () => {
    const result = GetPackOutputSchema.safeParse({
      id: 'p_1',
      userId: 'u_1',
      name: 'My Pack',
      description: null,
      category: null,
      isPublic: false,
      image: null,
      tags: null,
      deleted: false,
      isAIGenerated: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });
});

describe('U8 ListPacksOutputSchema', () => {
  it('accepts the MCP-side envelope with nextOffset', () => {
    const result = ListPacksOutputSchema.safeParse({
      data: [
        {
          id: 'p_1',
          userId: 'u_1',
          name: 'P',
          description: null,
          category: null,
          isPublic: false,
          image: null,
          tags: null,
          deleted: false,
          isAIGenerated: false,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      nextOffset: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects when an array element is the wrong shape', () => {
    const result = ListPacksOutputSchema.safeParse({
      data: [{ id: 123 }], // id should be string, not number
      nextOffset: null,
    });
    expect(result.success).toBe(false);
  });
});

describe('U8 GetTripOutputSchema', () => {
  it('accepts a minimal trip', () => {
    const result = GetTripOutputSchema.safeParse({
      id: 't_1',
      name: 'A trip',
      deleted: false,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing required field (deleted)', () => {
    const result = GetTripOutputSchema.safeParse({ id: 't_1', name: 'A' });
    expect(result.success).toBe(false);
  });
});

describe('U8 ListTripsOutputSchema', () => {
  it('accepts a populated page', () => {
    const result = ListTripsOutputSchema.safeParse({
      data: [{ id: 't_1', name: 'A', deleted: false }],
      nextOffset: 0,
    });
    expect(result.success).toBe(true);
  });
});

describe('U8 GetWeatherOutputSchema (loose passthrough)', () => {
  it('accepts a representative WeatherAPI-shaped response', () => {
    const result = GetWeatherOutputSchema.safeParse({
      location: { name: 'Yosemite Valley', tz_id: 'America/Los_Angeles' },
      current: {
        temp_c: 12,
        temp_f: 53.6,
        condition: { text: 'Partly cloudy', code: 1003 },
        humidity: 50,
      },
      forecast: { forecastday: [] },
    });
    expect(result.success).toBe(true);
  });

  it('passes through unknown top-level keys (passthrough policy)', () => {
    const result = GetWeatherOutputSchema.safeParse({
      location: { name: 'X' },
      provider_internal_field: 'some opaque value',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-number temp_c', () => {
    const result = GetWeatherOutputSchema.safeParse({ current: { temp_c: 'hot' } });
    expect(result.success).toBe(false);
  });
});

describe('U8 admin analytics schemas', () => {
  it('AdminStatsOutputSchema accepts { users, packs, items }', () => {
    expect(AdminStatsOutputSchema.safeParse({ users: 10, packs: 20, items: 30 }).success).toBe(
      true,
    );
  });

  it('AdminStatsOutputSchema rejects non-numeric users', () => {
    expect(AdminStatsOutputSchema.safeParse({ users: 'ten', packs: 0, items: 0 }).success).toBe(
      false,
    );
  });

  it('AdminActiveUsersOutputSchema accepts { dau, wau, mau }', () => {
    expect(AdminActiveUsersOutputSchema.safeParse({ dau: 5, wau: 50, mau: 500 }).success).toBe(
      true,
    );
  });

  it('AdminCatalogOverviewOutputSchema accepts a representative shape', () => {
    const result = AdminCatalogOverviewOutputSchema.safeParse({
      totalItems: 1000,
      totalBrands: 50,
      avgPrice: 100,
      minPrice: 5,
      maxPrice: 500,
      embeddingCoverage: { total: 1000, withEmbedding: 800, pct: 0.8 },
      availability: [{ status: 'in_stock', count: 800 }],
      addedLast30Days: 50,
    });
    expect(result.success).toBe(true);
  });

  it('AdminAnalyticsGrowthOutputSchema accepts an array of growth points', () => {
    const result = AdminAnalyticsGrowthOutputSchema.safeParse([
      { period: '2026-W01', users: 100, packs: 50, catalogItems: 1000 },
    ]);
    expect(result.success).toBe(true);
  });

  it('AdminAnalyticsActivityOutputSchema accepts an array of activity points', () => {
    const result = AdminAnalyticsActivityOutputSchema.safeParse([
      { period: '2026-W01', trips: 10, trailReports: 20, posts: 30 },
    ]);
    expect(result.success).toBe(true);
  });

  it('AdminAnalyticsPackBreakdownOutputSchema accepts an array of category counts', () => {
    const result = AdminAnalyticsPackBreakdownOutputSchema.safeParse([
      { category: 'backpacking', count: 100 },
    ]);
    expect(result.success).toBe(true);
  });
});

// ── Cross-check: Tier 1 tools register an outputSchema ──────────────────────

function makeApiStub(): unknown {
  const handler: ProxyHandler<() => unknown> = {
    get: (_target, prop) => {
      if (prop === 'then') return undefined;
      return makeApiStub();
    },
    apply: () => Promise.resolve({ data: {}, error: null, status: 200 }),
  };
  return new Proxy(() => undefined, handler);
}

function buildToolCatalog() {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  const apiStub = makeApiStub() as AgentContext['api'];
  const agent: AgentContext = {
    server,
    api: apiStub,
    apiBaseUrl: 'https://api.test',
    setFeatureFlag: () => {
      /* no-op */
    },
    registerFlaggedTool: (_flag, ...args) =>
      (server.registerTool as (...a: unknown[]) => ReturnType<typeof server.registerTool>)(...args),
  };
  registerAuthTools(agent);
  registerPackTools(agent);
  registerTripTools(agent);
  registerWeatherTools(agent);
  registerAdminTools(agent);
  return (server as unknown as { _registeredTools: Record<string, { outputSchema?: unknown }> })
    ._registeredTools;
}

describe('U8 tier-1 tools register an outputSchema', () => {
  const tools = buildToolCatalog();

  // Tools the U8 plan calls out as tier-1 must surface an outputSchema so
  // structuredContent is validated by the SDK before send.
  const tier1 = [
    'packrat_whoami',
    'packrat_get_pack',
    'packrat_list_packs',
    'packrat_get_trip',
    'packrat_list_trips',
    'packrat_get_weather',
    'packrat_admin_stats',
    'packrat_admin_analytics_active_users',
    'packrat_admin_analytics_catalog_overview',
    'packrat_admin_analytics_growth',
    'packrat_admin_analytics_activity',
    'packrat_admin_analytics_pack_breakdown',
  ];

  it.each(tier1)('%s declares an outputSchema', (name) => {
    const tool = tools[name];
    expect(tool, `expected ${name} to be registered`).toBeDefined();
    expect(tool!.outputSchema, `${name}: outputSchema not registered`).toBeDefined();
  });
});

// ── Cross-check: a sample structured payload validates against the registered schema ──

describe('U8 schema/handler-emission consistency (spot-check)', () => {
  it('GetPackOutputSchema accepts a payload shaped like the registered Pack-with-items output', () => {
    // Smoke-test that a Pack-with-items payload still parses; if a future
    // refactor narrows PackWithItemsSchema, this will fail before
    // production where the SDK would reject the structuredContent at
    // runtime.
    const sample = {
      id: 'p_1',
      userId: 'u_1',
      name: 'P',
      description: null,
      category: null,
      isPublic: false,
      image: null,
      tags: null,
      deleted: false,
      isAIGenerated: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      items: [],
    };
    expect(GetPackOutputSchema.safeParse(sample).success).toBe(true);
  });

  it('AdminStatsOutputSchema accepts a payload shaped like the registered admin-stats output', () => {
    expect(AdminStatsOutputSchema.safeParse({ users: 1, packs: 1, items: 1 }).success).toBe(true);
  });
});
