/**
 * Tests for U9 resource expansion.
 *
 * Coverage:
 *   - Glossary static resource: returns markdown body with the
 *     expected mimeType, non-empty, mentions canary terms.
 *   - List providers on pack / trip / catalog templates: mocked API
 *     returning a list yields the right number of resource descriptors
 *     with packrat:// URIs; a thrown error degrades gracefully to an
 *     empty list rather than breaking resources/list across the board.
 *   - Search resource template: reading `packrat://search?q=tent`
 *     delegates to the catalog endpoint and returns formatted hits.
 *   - Error path: reading `packrat://packs/<bad>` throws an McpError
 *     (JSON-RPC-shaped failure, not success-with-error-body).
 *
 * Test strategy: instantiate a real `McpServer`, register resources
 * against a Proxy-shaped agent.api whose Treaty calls we override per
 * test. Reach into `_registeredResources` / `_registeredResourceTemplates`
 * to invoke the callbacks directly — same private-accessor pattern used
 * by the U7 annotations catalog test.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it, vi } from 'vitest';
import { GLOSSARY_MARKDOWN } from '../glossary';
import { CATALOG_LIST_CAP, registerResources } from '../resources';
import type { AgentContext } from '../types';
import { nth, prop } from './_access';

// ── Test scaffolding ─────────────────────────────────────────────────────────

type ApiOverrides = {
  packsGet?: (args?: unknown) => Promise<unknown>;
  tripsGet?: () => Promise<unknown>;
  catalogListGet?: (args?: unknown) => Promise<unknown>;
  catalogByIdGet?: (id: string) => Promise<unknown>;
  catalogCategoriesGet?: (args?: unknown) => Promise<unknown>;
  packByIdGet?: (id: string) => Promise<unknown>;
  tripByIdGet?: (id: string) => Promise<unknown>;
};

/**
 * Build an `api` stub that exposes the call paths used by `resources.ts`.
 * Each path can be overridden per test; defaults return an empty success.
 */
function makeApi(overrides: ApiOverrides = {}): AgentContext['api'] {
  const empty: () => Promise<{ data: unknown; error: null; status: number }> = () =>
    Promise.resolve({ data: [], error: null, status: 200 });

  const packsRoot = Object.assign(
    (args: { packId: string }) => ({
      get: () => (overrides.packByIdGet ?? (() => empty()))(args.packId),
    }),
    {
      get: (args?: unknown) => (overrides.packsGet ?? empty)(args),
    },
  );

  const tripsRoot = Object.assign(
    (args: { tripId: string }) => ({
      get: () => (overrides.tripByIdGet ?? (() => empty()))(args.tripId),
    }),
    {
      get: () => (overrides.tripsGet ?? empty)(),
    },
  );

  const catalogRoot = Object.assign(
    (args: { id: string }) => ({
      get: () => (overrides.catalogByIdGet ?? (() => empty()))(args.id),
    }),
    {
      get: (args?: unknown) => (overrides.catalogListGet ?? empty)(args),
      categories: {
        get: (args?: unknown) => (overrides.catalogCategoriesGet ?? empty)(args),
      },
    },
  );

  return {
    user: {
      packs: packsRoot,
      trips: tripsRoot,
      catalog: catalogRoot,
    },
    admin: {
      packs: packsRoot,
      trips: tripsRoot,
      catalog: catalogRoot,
    },
  } as unknown as AgentContext['api'];
}

function makeAgent(overrides: ApiOverrides = {}): {
  agent: AgentContext;
  server: McpServer;
} {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  const agent: AgentContext = {
    server,
    api: makeApi(overrides),
    apiBaseUrl: 'https://api.test',
    setFeatureFlag: () => {
      /* no-op */
    },
    registerFlaggedTool: () => {
      throw new Error('not used in resources tests');
    },
  };
  return { agent, server };
}

type RegisteredResource = {
  readCallback: (uri: URL, extra?: unknown) => Promise<unknown>;
  enabled: boolean;
};

type RegisteredResourceTemplate = {
  resourceTemplate: {
    uriTemplate: { toString: () => string };
    listCallback?: (extra?: unknown) => Promise<{ resources: unknown[] }>;
  };
  readCallback: (uri: URL, variables: Record<string, string>, extra?: unknown) => Promise<unknown>;
  enabled: boolean;
};

function getResources(server: McpServer) {
  const internal = server as unknown as {
    _registeredResources: Record<string, RegisteredResource>;
    _registeredResourceTemplates: Record<string, RegisteredResourceTemplate>;
  };
  return {
    fixed: internal._registeredResources,
    templates: internal._registeredResourceTemplates,
  };
}

function templateByName(server: McpServer, name: string): RegisteredResourceTemplate {
  const t = getResources(server).templates[name];
  if (!t) throw new Error(`template ${name} not registered`);
  return t;
}

// ── Glossary ─────────────────────────────────────────────────────────────────

describe('U9 glossary resource', () => {
  it('registers packrat://glossary as a static resource', () => {
    const { agent, server } = makeAgent();
    registerResources(agent);
    const { fixed } = getResources(server);
    expect(Object.keys(fixed)).toContain('packrat://glossary');
  });

  it('returns the glossary markdown with mimeType text/markdown', async () => {
    const { agent, server } = makeAgent();
    registerResources(agent);
    const resource = prop(getResources(server).fixed, 'packrat://glossary');
    const result = (await resource.readCallback(new URL('packrat://glossary'))) as {
      contents: Array<{ uri: string; mimeType: string; text: string }>;
    };
    expect(result.contents).toHaveLength(1);
    expect(nth(result.contents, 0).mimeType).toBe('text/markdown');
    expect(nth(result.contents, 0).text.length).toBeGreaterThan(0);
    expect(nth(result.contents, 0).text).toBe(GLOSSARY_MARKDOWN);
  });

  it('mentions canary terms reviewers will check for', () => {
    expect(GLOSSARY_MARKDOWN.toLowerCase()).toContain('base weight');
    expect(GLOSSARY_MARKDOWN).toContain('FKT');
    expect(GLOSSARY_MARKDOWN.toLowerCase()).toContain('mcp:admin');
    expect(GLOSSARY_MARKDOWN.toLowerCase()).toContain('pack');
    expect(GLOSSARY_MARKDOWN.toLowerCase()).toContain('alltrails');
  });

  it('fits under the 50 KB cap mentioned in the U9 plan', () => {
    expect(GLOSSARY_MARKDOWN.length).toBeLessThanOrEqual(50_000);
  });
});

// ── List providers ───────────────────────────────────────────────────────────

describe('U9 pack list provider', () => {
  it('enumerates user packs with packrat://packs/<id> URIs', async () => {
    const { agent, server } = makeAgent({
      packsGet: () =>
        Promise.resolve({
          data: [
            { id: 'p_one', name: 'Weekend Pack' },
            { id: 'p_two', name: 'Thru Pack' },
            { id: 'p_three', name: 'Day Pack' },
          ],
          error: null,
          status: 200,
        }),
    });
    registerResources(agent);
    const template = templateByName(server, 'pack');
    const result = await (
      template.resourceTemplate.listCallback as () => Promise<{
        resources: Array<{ uri: string; name: string; mimeType?: string }>;
      }>
    )();
    expect(result.resources).toHaveLength(3);
    expect(nth(result.resources, 0).uri).toBe('packrat://packs/p_one');
    expect(nth(result.resources, 0).name).toBe('Weekend Pack');
    expect(nth(result.resources, 2).uri).toBe('packrat://packs/p_three');
    expect(result.resources.every((r) => r.mimeType === 'application/json')).toBe(true);
  });

  it('falls back to a synthetic name when name is missing', async () => {
    const { agent, server } = makeAgent({
      packsGet: () =>
        Promise.resolve({
          data: [{ id: 'p_no_name' }],
          error: null,
          status: 200,
        }),
    });
    registerResources(agent);
    const template = templateByName(server, 'pack');
    const result = await (
      template.resourceTemplate.listCallback as () => Promise<{
        resources: Array<{ uri: string; name: string }>;
      }>
    )();
    expect(nth(result.resources, 0).name).toBe('Pack p_no_name');
  });

  it('skips entries without a string id', async () => {
    const { agent, server } = makeAgent({
      packsGet: () =>
        Promise.resolve({
          data: [{ id: 'p_one', name: 'A' }, { name: 'no-id' }, { id: 42, name: 'numeric-id' }],
          error: null,
          status: 200,
        }),
    });
    registerResources(agent);
    const template = templateByName(server, 'pack');
    const result = await (
      template.resourceTemplate.listCallback as () => Promise<{
        resources: Array<{ uri: string }>;
      }>
    )();
    expect(result.resources).toHaveLength(1);
    expect(nth(result.resources, 0).uri).toBe('packrat://packs/p_one');
  });

  it('returns empty array when the API errors (graceful degradation)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { agent, server } = makeAgent({
      packsGet: () =>
        Promise.resolve({ data: null, error: { status: 500, value: 'oops' }, status: 500 }),
    });
    registerResources(agent);
    const template = templateByName(server, 'pack');
    const result = await (
      template.resourceTemplate.listCallback as () => Promise<{
        resources: unknown[];
      }>
    )();
    expect(result.resources).toEqual([]);
    warn.mockRestore();
  });

  it('returns empty array (and logs warning) when the API throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { agent, server } = makeAgent({
      packsGet: () => Promise.reject(new Error('network down')),
    });
    registerResources(agent);
    const template = templateByName(server, 'pack');
    const result = await (
      template.resourceTemplate.listCallback as () => Promise<{
        resources: unknown[];
      }>
    )();
    expect(result.resources).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/packs/);
    warn.mockRestore();
  });
});

describe('U9 trip list provider', () => {
  it('enumerates user trips with packrat://trips/<id> URIs', async () => {
    const { agent, server } = makeAgent({
      tripsGet: () =>
        Promise.resolve({
          data: [
            { id: 't_one', name: 'JMT 2026' },
            { id: 't_two', destination: 'Wind River Range' },
            { id: 't_three' },
          ],
          error: null,
          status: 200,
        }),
    });
    registerResources(agent);
    const template = templateByName(server, 'trip');
    const result = await (
      template.resourceTemplate.listCallback as () => Promise<{
        resources: Array<{ uri: string; name: string }>;
      }>
    )();
    expect(result.resources).toHaveLength(3);
    expect(nth(result.resources, 0).name).toBe('JMT 2026');
    expect(nth(result.resources, 1).name).toBe('Wind River Range');
    expect(nth(result.resources, 2).name).toBe('Trip t_three');
  });

  it('returns empty array on API error (no propagation)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { agent, server } = makeAgent({
      tripsGet: () => Promise.reject('boom'),
    });
    registerResources(agent);
    const template = templateByName(server, 'trip');
    const result = await (
      template.resourceTemplate.listCallback as () => Promise<{
        resources: unknown[];
      }>
    )();
    expect(result.resources).toEqual([]);
    warn.mockRestore();
  });
});

describe('U9 catalog list provider', () => {
  it('caps catalog list at CATALOG_LIST_CAP entries', async () => {
    const items = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      name: `Item ${i + 1}`,
      brand: 'TestBrand',
    }));
    const calls: unknown[] = [];
    const { agent, server } = makeAgent({
      catalogListGet: (args) => {
        calls.push(args);
        return Promise.resolve({
          data: {
            items,
            totalCount: items.length,
            page: 1,
            limit: CATALOG_LIST_CAP,
            totalPages: 4,
          },
          error: null,
          status: 200,
        });
      },
    });
    registerResources(agent);
    const template = templateByName(server, 'catalog_item');
    const result = await (
      template.resourceTemplate.listCallback as () => Promise<{
        resources: Array<{ uri: string; name: string }>;
      }>
    )();
    expect(result.resources.length).toBeLessThanOrEqual(CATALOG_LIST_CAP);
    expect(nth(result.resources, 0).uri).toBe('packrat://catalog/1');
    expect(nth(result.resources, 0).name).toBe('TestBrand Item 1');
    // The provider should have requested a limit of CATALOG_LIST_CAP from the API
    expect((calls[0] as { query?: { limit?: number } })?.query?.limit).toBe(CATALOG_LIST_CAP);
  });

  it('handles a bare array response (no { items } wrapper)', async () => {
    const { agent, server } = makeAgent({
      catalogListGet: () =>
        Promise.resolve({
          data: [{ id: 5, name: 'Bare item' }],
          error: null,
          status: 200,
        }),
    });
    registerResources(agent);
    const template = templateByName(server, 'catalog_item');
    const result = await (
      template.resourceTemplate.listCallback as () => Promise<{
        resources: Array<{ uri: string }>;
      }>
    )();
    expect(result.resources).toHaveLength(1);
    expect(nth(result.resources, 0).uri).toBe('packrat://catalog/5');
  });

  it('returns empty array on API error', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { agent, server } = makeAgent({
      catalogListGet: () =>
        Promise.resolve({ data: null, error: { status: 503, value: null }, status: 503 }),
    });
    registerResources(agent);
    const template = templateByName(server, 'catalog_item');
    const result = await (
      template.resourceTemplate.listCallback as () => Promise<{
        resources: unknown[];
      }>
    )();
    expect(result.resources).toEqual([]);
    warn.mockRestore();
  });
});

// ── Search resource template ─────────────────────────────────────────────────

describe('U9 search resource template', () => {
  it('registers packrat://search?q={query}', () => {
    const { agent, server } = makeAgent();
    registerResources(agent);
    const template = templateByName(server, 'search');
    expect(template.resourceTemplate.uriTemplate.toString()).toContain('search');
    expect(template.resourceTemplate.uriTemplate.toString()).toContain('{query}');
  });

  it('delegates read to the catalog list endpoint with q', async () => {
    const calls: unknown[] = [];
    const { agent, server } = makeAgent({
      catalogListGet: (args) => {
        calls.push(args);
        return Promise.resolve({
          data: {
            items: [{ id: 7, name: 'Tent' }],
            totalCount: 1,
            page: 1,
            limit: 20,
            totalPages: 1,
          },
          error: null,
          status: 200,
        });
      },
    });
    registerResources(agent);
    const template = templateByName(server, 'search');
    const result = (await template.readCallback(new URL('packrat://search?q=tent'), {
      query: 'tent',
    })) as { contents: Array<{ uri: string; mimeType: string; text: string }> };
    expect(result.contents).toHaveLength(1);
    expect(nth(result.contents, 0).mimeType).toBe('application/json');
    expect(nth(result.contents, 0).text).toContain('Tent');
    const callArgs = calls[0] as { query?: { q?: string; limit?: number } };
    expect(callArgs?.query?.q).toBe('tent');
    expect(typeof callArgs?.query?.limit).toBe('number');
  });
});

// ── Error path: error-shaped vs. success-with-error-body ─────────────────────

describe('U9 resource error handling', () => {
  it('reading a pack that 404s throws McpError (JSON-RPC shape, not success body)', async () => {
    const { agent, server } = makeAgent({
      packByIdGet: () =>
        Promise.resolve({
          data: null,
          error: { status: 404, value: { message: 'not found' } },
          status: 404,
        }),
    });
    registerResources(agent);
    const template = templateByName(server, 'pack');
    await expect(
      template.readCallback(new URL('packrat://packs/p_nope'), { packId: 'p_nope' }),
    ).rejects.toBeInstanceOf(McpError);
  });

  it('reading a pack that the API throws on surfaces as McpError', async () => {
    const { agent, server } = makeAgent({
      packByIdGet: () => Promise.reject(new Error('socket hang up')),
    });
    registerResources(agent);
    const template = templateByName(server, 'pack');
    await expect(
      template.readCallback(new URL('packrat://packs/p_oops'), { packId: 'p_oops' }),
    ).rejects.toBeInstanceOf(McpError);
  });

  it('500 errors map onto InternalError (-32603)', async () => {
    const { agent, server } = makeAgent({
      packByIdGet: () =>
        Promise.resolve({ data: null, error: { status: 500, value: null }, status: 500 }),
    });
    registerResources(agent);
    const template = templateByName(server, 'pack');
    await expect(
      template.readCallback(new URL('packrat://packs/p_x'), { packId: 'p_x' }),
    ).rejects.toMatchObject({ code: -32603 });
  });

  it('404 errors map onto InvalidParams (-32602)', async () => {
    const { agent, server } = makeAgent({
      packByIdGet: () =>
        Promise.resolve({ data: null, error: { status: 404, value: 'gone' }, status: 404 }),
    });
    registerResources(agent);
    const template = templateByName(server, 'pack');
    await expect(
      template.readCallback(new URL('packrat://packs/p_x'), { packId: 'p_x' }),
    ).rejects.toMatchObject({ code: -32602 });
  });

  it('success path returns JSON-stringified content', async () => {
    const { agent, server } = makeAgent({
      packByIdGet: () =>
        Promise.resolve({ data: { id: 'p_ok', name: 'My Pack' }, error: null, status: 200 }),
    });
    registerResources(agent);
    const template = templateByName(server, 'pack');
    const result = (await template.readCallback(new URL('packrat://packs/p_ok'), {
      packId: 'p_ok',
    })) as { contents: Array<{ uri: string; mimeType: string; text: string }> };
    expect(nth(result.contents, 0).mimeType).toBe('application/json');
    expect(nth(result.contents, 0).text).toContain('p_ok');
    expect(nth(result.contents, 0).text).toContain('My Pack');
  });
});

// ── Catalog/categories static resource ───────────────────────────────────────

describe('U9 static catalog/categories resource', () => {
  it('still registers packrat://catalog/categories', () => {
    const { agent, server } = makeAgent();
    registerResources(agent);
    const { fixed } = getResources(server);
    expect(Object.keys(fixed)).toContain('packrat://catalog/categories');
  });

  it('returns JSON content from the categories endpoint', async () => {
    const { agent, server } = makeAgent({
      catalogCategoriesGet: () =>
        Promise.resolve({
          data: [{ name: 'tents', count: 12 }],
          error: null,
          status: 200,
        }),
    });
    registerResources(agent);
    const resource = prop(getResources(server).fixed, 'packrat://catalog/categories');
    const result = (await resource.readCallback(new URL('packrat://catalog/categories'))) as {
      contents: Array<{ uri: string; mimeType: string; text: string }>;
    };
    expect(nth(result.contents, 0).mimeType).toBe('application/json');
    expect(nth(result.contents, 0).text).toContain('tents');
  });

  it('throws McpError on categories endpoint failure', async () => {
    const { agent, server } = makeAgent({
      catalogCategoriesGet: () =>
        Promise.resolve({ data: null, error: { status: 502, value: null }, status: 502 }),
    });
    registerResources(agent);
    const resource = prop(getResources(server).fixed, 'packrat://catalog/categories');
    await expect(
      resource.readCallback(new URL('packrat://catalog/categories')),
    ).rejects.toBeInstanceOf(McpError);
  });
});

// ── Resource catalog audit ───────────────────────────────────────────────────

describe('U9 registered resource catalog', () => {
  it('registers exactly the expected templated + fixed surface', () => {
    const { agent, server } = makeAgent();
    registerResources(agent);
    const { fixed, templates } = getResources(server);

    // Fixed (static) resources
    expect(Object.keys(fixed).sort()).toEqual(
      ['packrat://catalog/categories', 'packrat://glossary'].sort(),
    );

    // Templates
    expect(Object.keys(templates).sort()).toEqual(
      ['catalog_item', 'pack', 'search', 'trip'].sort(),
    );

    // Each non-search template has a list provider; search does not.
    expect(prop(templates, 'pack').resourceTemplate.listCallback).toBeDefined();
    expect(prop(templates, 'trip').resourceTemplate.listCallback).toBeDefined();
    expect(prop(templates, 'catalog_item').resourceTemplate.listCallback).toBeDefined();
    expect(prop(templates, 'search').resourceTemplate.listCallback).toBeUndefined();
  });
});
