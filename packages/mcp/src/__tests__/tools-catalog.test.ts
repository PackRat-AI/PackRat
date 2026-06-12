/**
 * Real unit tests for every catalog tool HANDLER.
 *
 * Each test registers the catalog tools against a stub agent (whose `api` is
 * a recording Proxy that resolves HTTP verbs to a success-shaped Treaty
 * result), pulls the handler from the SDK registry, invokes it with VALID
 * args (enum-typed fields use the real `../enums` members), then asserts both:
 *   1. the handler returned a non-empty text content block, and
 *   2. the expected Treaty endpoint was hit — matched by its terminal HTTP
 *      verb plus the distinguishing path segments.
 *
 * The recording Proxy logs a `()` marker segment for every non-verb call
 * (e.g. `catalog({ id })`), so `api.user.catalog({ id }).similar.get()` shows
 * up as `['user','catalog','()','similar','get']`.
 */

import { describe, expect, it } from 'vitest';
import { CatalogSortField, SortOrder } from '../enums';
import { registerCatalogTools } from '../tools/catalog';
import { type ApiCall, firstText, getToolHandler, makeAgent, makeExtra } from './_tool-harness';

/** True when `call.path` ends with `segments` (terminal-verb-anchored match). */
function pathEndsWith(call: ApiCall, segments: string[]): boolean {
  const tail = call.path.slice(-segments.length);
  return tail.length === segments.length && tail.every((seg, i) => seg === segments[i]);
}

/** Count recorded calls whose path ends with the given terminal segments. */
function countCalls(calls: ApiCall[], segments: string[]): number {
  return calls.filter((c) => pathEndsWith(c, segments)).length;
}

describe('packrat_search_gear_catalog', () => {
  it('GETs the catalog with enum sort and returns a text block', async () => {
    const { agent, server, calls } = makeAgent();
    registerCatalogTools(agent);
    const result = await getToolHandler(server, 'packrat_search_gear_catalog')(
      {
        query: 'ultralight sleeping bag',
        category: 'sleeping bags',
        limit: 10,
        page: 1,
        sort_by: CatalogSortField.Price,
        sort_order: SortOrder.Desc,
      },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(countCalls(calls, ['user', 'catalog', 'get'])).toBe(1);
  });

  it('GETs the catalog without a sort field (sort omitted) and returns a text block', async () => {
    const { agent, server, calls } = makeAgent();
    registerCatalogTools(agent);
    const result = await getToolHandler(server, 'packrat_search_gear_catalog')(
      { limit: 10, page: 1, sort_order: SortOrder.Asc },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(countCalls(calls, ['user', 'catalog', 'get'])).toBe(1);
  });
});

describe('packrat_semantic_gear_search', () => {
  it('GETs the vector-search endpoint and returns a text block', async () => {
    const { agent, server, calls } = makeAgent();
    registerCatalogTools(agent);
    const result = await getToolHandler(server, 'packrat_semantic_gear_search')(
      { query: 'warm lightweight insulation layer', limit: 8 },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(countCalls(calls, ['user', 'catalog', 'vector-search', 'get'])).toBe(1);
  });
});

describe('packrat_get_catalog_item', () => {
  it('GETs a single catalog item by id and returns a text block', async () => {
    const { agent, server, calls } = makeAgent();
    registerCatalogTools(agent);
    const result = await getToolHandler(server, 'packrat_get_catalog_item')(
      { item_id: 42 },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(countCalls(calls, ['user', 'catalog', '()', 'get'])).toBe(1);
  });
});

describe('packrat_similar_catalog_items', () => {
  it('GETs the similar endpoint with a threshold and returns a text block', async () => {
    const { agent, server, calls } = makeAgent();
    registerCatalogTools(agent);
    const result = await getToolHandler(server, 'packrat_similar_catalog_items')(
      { item_id: 42, limit: 10, threshold: 0.8 },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(countCalls(calls, ['user', 'catalog', '()', 'similar', 'get'])).toBe(1);
  });

  it('GETs the similar endpoint without a threshold (omitted) and returns a text block', async () => {
    const { agent, server, calls } = makeAgent();
    registerCatalogTools(agent);
    const result = await getToolHandler(server, 'packrat_similar_catalog_items')(
      { item_id: 42, limit: 10 },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(countCalls(calls, ['user', 'catalog', '()', 'similar', 'get'])).toBe(1);
  });
});

describe('packrat_list_gear_categories', () => {
  it('GETs the categories endpoint and returns a text block', async () => {
    const { agent, server, calls } = makeAgent();
    registerCatalogTools(agent);
    const result = await getToolHandler(server, 'packrat_list_gear_categories')(
      { limit: 50 },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(countCalls(calls, ['user', 'catalog', 'categories', 'get'])).toBe(1);
  });
});

describe('packrat_create_catalog_item', () => {
  it('POSTs a new catalog item and returns a text block', async () => {
    const { agent, server, calls } = makeAgent();
    registerCatalogTools(agent);
    const result = await getToolHandler(server, 'packrat_create_catalog_item')(
      {
        name: 'Ultralight Quilt 20F',
        description: 'Down quilt',
        brand: 'PackRat',
        model: 'UQ20',
        weight: 567,
        weight_unit: 'g',
        sku: 'PR-UQ20',
        categories: ['sleep'],
        images: ['quilt.jpg'],
        rating: 4.5,
        product_url: 'https://example.com/uq20',
      },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(countCalls(calls, ['user', 'catalog', 'post'])).toBe(1);
  });
});

describe('packrat_compare_gear_items', () => {
  it('POSTs to the compare endpoint and returns a text block', async () => {
    const { agent, server, calls } = makeAgent();
    registerCatalogTools(agent);
    const result = await getToolHandler(server, 'packrat_compare_gear_items')(
      { item_ids: [1, 2, 3] },
      makeExtra(),
    );

    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(countCalls(calls, ['user', 'catalog', 'compare', 'post'])).toBe(1);
  });
});
