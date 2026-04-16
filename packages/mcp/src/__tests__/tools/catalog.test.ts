import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PackRatApiClient } from '../../client';
import { ApiError } from '../../client';
import { registerCatalogTools } from '../../tools/catalog';
import type { RegisteredTool } from '../helpers';
import { buildMockAgent, callTool, parseToolResult } from '../helpers';

describe('catalog tools', () => {
  let api: PackRatApiClient;
  let tools: Map<string, RegisteredTool>;

  beforeEach(() => {
    const mock = buildMockAgent();
    api = mock.api;
    tools = mock.tools;
    registerCatalogTools(mock.agent);
  });

  // ── search_gear_catalog ─────────────────────────────────────────────────────

  describe('search_gear_catalog', () => {
    it('is registered', () => {
      expect(tools.has('search_gear_catalog')).toBe(true);
    });

    it('calls GET /catalog with all params', async () => {
      vi.mocked(api.get).mockResolvedValue({ items: [] });

      await callTool(tools, 'search_gear_catalog', {
        query: 'ultralight tent',
        category: 'tents',
        limit: 5,
        offset: 0,
        sort_by: 'price',
        sort_order: 'asc',
      });

      expect(api.get).toHaveBeenCalledWith('/catalog', {
        q: 'ultralight tent',
        category: 'tents',
        limit: 5,
        offset: 0,
        'sort[field]': 'price',
        'sort[order]': 'asc',
      });
    });

    it('returns error result on API failure', async () => {
      vi.mocked(api.get).mockRejectedValue(new ApiError('Server Error', 500, {}));

      const result = await callTool(tools, 'search_gear_catalog', {
        limit: 10,
        offset: 0,
        sort_order: 'asc',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('500');
    });
  });

  // ── semantic_gear_search ────────────────────────────────────────────────────

  describe('semantic_gear_search', () => {
    it('calls GET /catalog/vector-search', async () => {
      vi.mocked(api.get).mockResolvedValue({ items: [], total: 0 });

      await callTool(tools, 'semantic_gear_search', {
        query: 'warm puffy jacket for winter camping',
        limit: 5,
        offset: 0,
      });

      expect(api.get).toHaveBeenCalledWith('/catalog/vector-search', {
        q: 'warm puffy jacket for winter camping',
        limit: 5,
        offset: 0,
      });
    });

    it('returns items from the semantic search', async () => {
      const items = [{ id: 1, name: "Arc'teryx Atom LT" }];
      vi.mocked(api.get).mockResolvedValue({ items });

      const result = await callTool(tools, 'semantic_gear_search', {
        query: 'midlayer fleece',
        limit: 8,
        offset: 0,
      });

      expect(parseToolResult(result)).toEqual({ items });
    });
  });

  // ── get_catalog_item ────────────────────────────────────────────────────────

  describe('get_catalog_item', () => {
    it('calls GET /catalog/:id', async () => {
      const item = { id: 42, name: 'Big Agnes Copper Spur' };
      vi.mocked(api.get).mockResolvedValue(item);

      const result = await callTool(tools, 'get_catalog_item', { item_id: 42 });

      expect(api.get).toHaveBeenCalledWith('/catalog/42');
      expect(parseToolResult(result)).toEqual(item);
    });

    it('propagates 404 as error result', async () => {
      vi.mocked(api.get).mockRejectedValue(new ApiError('Not Found', 404, {}));

      const result = await callTool(tools, 'get_catalog_item', { item_id: 9999 });

      expect(result.isError).toBe(true);
    });
  });

  // ── list_gear_categories ────────────────────────────────────────────────────

  describe('list_gear_categories', () => {
    it('calls GET /catalog/categories with no params', async () => {
      vi.mocked(api.get).mockResolvedValue([{ name: 'tents', count: 120 }]);

      const result = await callTool(tools, 'list_gear_categories', {});

      expect(api.get).toHaveBeenCalledWith('/catalog/categories');
      expect(Array.isArray(parseToolResult(result))).toBe(true);
    });
  });

  // ── compare_gear_items ──────────────────────────────────────────────────────

  describe('compare_gear_items', () => {
    it('fetches all items and returns sorted comparison', async () => {
      // Items returned in order of ids 1, 2, 3
      vi.mocked(api.get)
        .mockResolvedValueOnce({
          id: 1,
          name: 'Heavy Tent',
          brand: 'GenericBrand',
          category: 'tents',
          weight: 2000,
          price: 20000,
          ratingValue: 4.0,
          ratingCount: 50,
          productUrl: 'https://x.com',
        })
        .mockResolvedValueOnce({
          id: 2,
          name: 'Ultralight Tent',
          brand: 'GossamerGear',
          category: 'tents',
          weight: 700,
          price: 55000,
          ratingValue: 4.8,
          ratingCount: 200,
          productUrl: 'https://y.com',
        })
        .mockResolvedValueOnce({
          id: 3,
          name: 'Mid Tent',
          brand: 'MSR',
          category: 'tents',
          weight: 1200,
          price: 35000,
          ratingValue: 4.5,
          ratingCount: 150,
          productUrl: 'https://z.com',
        });

      const result = await callTool(tools, 'compare_gear_items', { item_ids: [1, 2, 3] });
      const comparison = parseToolResult(result) as Record<string, unknown>;

      expect((comparison.items as unknown[]).length).toBe(3);
      // sorted by weight asc → Ultralight first
      expect((comparison.items as Array<Record<string, unknown>>)[0].name).toBe('Ultralight Tent');
      expect(comparison.lightest).toBe('Ultralight Tent');
      expect(comparison.highestRated).toBe('Ultralight Tent');
      expect(comparison.cheapest).toBe('Heavy Tent');
    });

    it('returns error result if any item fetch fails', async () => {
      vi.mocked(api.get).mockRejectedValue(new ApiError('Not Found', 404, {}));

      const result = await callTool(tools, 'compare_gear_items', { item_ids: [1, 2] });

      expect(result.isError).toBe(true);
    });
  });
});
