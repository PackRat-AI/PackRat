import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PackRatApiClient } from '../../client';
import { ApiError } from '../../client';
import { registerKnowledgeTools } from '../../tools/knowledge';
import type { RegisteredTool } from '../helpers';
import { buildMockAgent, callTool, parseToolResult } from '../helpers';

describe('knowledge tools', () => {
  let api: PackRatApiClient;
  let tools: Map<string, RegisteredTool>;

  beforeEach(() => {
    const mock = buildMockAgent();
    api = mock.api;
    tools = mock.tools;
    registerKnowledgeTools(mock.agent);
  });

  // ── search_outdoor_guides ───────────────────────────────────────────────────

  describe('search_outdoor_guides', () => {
    it('is registered', () => {
      expect(tools.has('search_outdoor_guides')).toBe(true);
    });

    it('calls GET /ai/rag-search with query and limit', async () => {
      const guides = { results: [{ title: 'Bear Hang Guide', content: '...' }] };
      vi.mocked(api.get).mockResolvedValue(guides);

      const result = await callTool({
        tools,
        name: 'search_outdoor_guides',
        args: {
          query: 'how to set up a bear hang',
          limit: 3,
        },
      });

      expect(api.get).toHaveBeenCalledWith('/ai/rag-search', {
        q: 'how to set up a bear hang',
        limit: 3,
      });
      expect(parseToolResult(result)).toEqual(guides);
    });

    it('returns error result on API failure', async () => {
      vi.mocked(api.get).mockRejectedValue(
        new ApiError('Service Unavailable', { status: 503, body: {} }),
      );

      const result = await callTool({
        tools,
        name: 'search_outdoor_guides',
        args: {
          query: 'water treatment methods',
          limit: 5,
        },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('503');
    });
  });

  // ── web_search ──────────────────────────────────────────────────────────────

  describe('web_search', () => {
    it('is registered', () => {
      expect(tools.has('web_search')).toBe(true);
    });

    it('calls GET /ai/web-search with query', async () => {
      const webResult = { answer: 'JMT permits are available...', sources: [] };
      vi.mocked(api.get).mockResolvedValue(webResult);

      const result = await callTool({
        tools,
        name: 'web_search',
        args: {
          query: 'John Muir Trail permit availability 2025',
        },
      });

      expect(api.get).toHaveBeenCalledWith('/ai/web-search', {
        q: 'John Muir Trail permit availability 2025',
      });
      expect(parseToolResult(result)).toEqual(webResult);
    });

    it('returns error when network fails', async () => {
      vi.mocked(api.get).mockRejectedValue(new Error('fetch failed'));

      const result = await callTool({ tools, name: 'web_search', args: { query: 'test query' } });

      expect(result.isError).toBe(true);
    });
  });

  // ── execute_sql_query ───────────────────────────────────────────────────────

  describe('execute_sql_query', () => {
    it('is registered', () => {
      expect(tools.has('execute_sql_query')).toBe(true);
    });

    it('calls POST /ai/execute-sql with query and limit', async () => {
      const rows = [{ name: 'Zpacks Duplex', weight: 510 }];
      vi.mocked(api.post).mockResolvedValue({ rows, rowCount: 1 });

      const sql =
        "SELECT name, weight FROM catalog_items WHERE category = 'tents' ORDER BY weight ASC LIMIT 5";
      const result = await callTool({
        tools,
        name: 'execute_sql_query',
        args: { query: sql, limit: 50 },
      });

      const [path, body] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, unknown>];
      expect(path).toBe('/ai/execute-sql');
      expect(body.query).toBe(sql);
      expect(body.limit).toBe(50);
      expect((parseToolResult(result) as Record<string, unknown>).rowCount).toBe(1);
    });

    it('returns error for failed queries', async () => {
      vi.mocked(api.post).mockRejectedValue(
        new ApiError('Syntax error in SQL', { status: 400, body: {} }),
      );

      const result = await callTool({
        tools,
        name: 'execute_sql_query',
        args: {
          query: 'SELECT * FROM nonexistent_table',
          limit: 100,
        },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('400');
    });
  });

  // ── get_database_schema ─────────────────────────────────────────────────────

  describe('get_database_schema', () => {
    it('is registered', () => {
      expect(tools.has('get_database_schema')).toBe(true);
    });

    it('calls GET /ai/db-schema with no params', async () => {
      const schema = { tables: [{ name: 'catalog_items', columns: ['id', 'name', 'weight'] }] };
      vi.mocked(api.get).mockResolvedValue(schema);

      const result = await callTool({ tools, name: 'get_database_schema', args: {} });

      expect(api.get).toHaveBeenCalledWith('/ai/db-schema');
      expect(parseToolResult(result)).toEqual(schema);
    });
  });
});
