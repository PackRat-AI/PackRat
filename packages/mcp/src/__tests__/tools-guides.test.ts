/**
 * Real handler tests for every tool registered by `registerGuidesTools`.
 *
 * Strategy mirrors tools-admin.test.ts / tools-weather.test.ts: build a real
 * `McpServer`, register the guides tools against a stub `AgentContext` whose
 * `api` is a Proxy that records every Treaty property chain + terminal verb,
 * then invoke each tool's handler directly and assert both (a) the handler
 * returns a non-empty text content block and (b) the expected Treaty endpoint
 * was hit (specific path segments + terminal `get`).
 *
 * All four tools are read-only (no elicitation), so the stub's default
 * `{ data: { success: true } }` resolution drives the happy path. We also
 * exercise the optional `category` / `sort_field` / `sort_order` branches of
 * `packrat_list_guides` so the conditional `sort` payload path is covered.
 */

import { describe, expect, it } from 'vitest';
import { registerGuidesTools } from '../tools/guides';
import { nth } from './_access';
import { type ApiCall, firstText, getToolHandler, makeAgent, makeExtra } from './_tool-harness';

/** True if some recorded call's path ends with `segments` (last = terminal verb). */
function hasCallEndingWith(calls: ApiCall[], segments: string[]): boolean {
  return calls.some((c) => {
    if (c.path.length < segments.length) return false;
    const tail = c.path.slice(c.path.length - segments.length);
    return segments.every((seg, i) => nth(tail, i) === seg);
  });
}

describe('packrat_list_guides', () => {
  it('returns text content and hits user.guides.get with defaults', async () => {
    const { agent, server, calls } = makeAgent();
    registerGuidesTools(agent);

    const result = await getToolHandler(server, 'packrat_list_guides')(
      { page: 1, limit: 20 },
      makeExtra(),
    );

    expect(nth(result.content, 0).type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hasCallEndingWith(calls, ['user', 'guides', 'get'])).toBe(true);
  });

  it('passes category + sort into the query and still hits user.guides.get', async () => {
    const { agent, server, calls } = makeAgent();
    registerGuidesTools(agent);

    const result = await getToolHandler(server, 'packrat_list_guides')(
      { page: 2, limit: 10, category: 'backpacking', sort_field: 'title', sort_order: 'desc' },
      makeExtra(),
    );

    expect(nth(result.content, 0).type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);

    const getCalls = calls.filter((c) => c.path.at(-1) === 'get' && c.path.includes('guides'));
    expect(getCalls).toHaveLength(1);
    expect(nth(nth(getCalls, 0).args, 0)).toEqual({
      query: {
        page: 2,
        limit: 10,
        category: 'backpacking',
        sort: { field: 'title', order: 'desc' },
      },
    });
  });

  it("defaults sort order to 'asc' when sort_field is set without sort_order", async () => {
    const { agent, server, calls } = makeAgent();
    registerGuidesTools(agent);

    const result = await getToolHandler(server, 'packrat_list_guides')(
      { page: 1, limit: 20, sort_field: 'createdAt' },
      makeExtra(),
    );

    expect(nth(result.content, 0).type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);

    const getCalls = calls.filter((c) => c.path.at(-1) === 'get' && c.path.includes('guides'));
    expect(getCalls).toHaveLength(1);
    expect(nth(nth(getCalls, 0).args, 0)).toEqual({
      query: {
        page: 1,
        limit: 20,
        category: undefined,
        sort: { field: 'createdAt', order: 'asc' },
      },
    });
  });
});

describe('packrat_list_guide_categories', () => {
  it('returns text content and hits user.guides.categories.get', async () => {
    const { agent, server, calls } = makeAgent();
    registerGuidesTools(agent);

    const result = await getToolHandler(server, 'packrat_list_guide_categories')({}, makeExtra());

    expect(nth(result.content, 0).type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hasCallEndingWith(calls, ['user', 'guides', 'categories', 'get'])).toBe(true);
  });
});

describe('packrat_search_guides', () => {
  it('returns text content and hits user.guides.search.get', async () => {
    const { agent, server, calls } = makeAgent();
    registerGuidesTools(agent);

    const result = await getToolHandler(server, 'packrat_search_guides')(
      { query: 'water filter', page: 1, limit: 20, category: 'gear' },
      makeExtra(),
    );

    expect(nth(result.content, 0).type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hasCallEndingWith(calls, ['user', 'guides', 'search', 'get'])).toBe(true);
  });
});

describe('packrat_get_guide', () => {
  it('returns text content and hits user.guides({id}).get', async () => {
    const { agent, server, calls } = makeAgent();
    registerGuidesTools(agent);

    const result = await getToolHandler(server, 'packrat_get_guide')(
      { guide_id: 'guide-42' },
      makeExtra(),
    );

    expect(nth(result.content, 0).type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);

    // `user.guides({ id })` is a non-verb call segment whose recorded path
    // ends with `guides` and carries the `{ id }` arg.
    const guideCalls = calls.filter((c) => c.path.at(-1) === 'guides' && c.args.length > 0);
    expect(guideCalls).toHaveLength(1);
    expect(nth(nth(guideCalls, 0).args, 0)).toEqual({ id: 'guide-42' });
    // The `{ id }` call returns a chainable proxy (`()` segment) then `.get()`.
    expect(hasCallEndingWith(calls, ['guides', '()', 'get'])).toBe(true);
  });
});
