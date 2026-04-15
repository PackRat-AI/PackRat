import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../client'
import { registerKnowledgeTools } from '../../tools/knowledge'
import { buildMockAgent, callTool, parseToolResult } from '../helpers'
import type { PackRatApiClient } from '../../client'
import type { RegisteredTool } from '../helpers'

describe('knowledge tools', () => {
  let api: PackRatApiClient
  let tools: Map<string, RegisteredTool>

  beforeEach(() => {
    const mock = buildMockAgent()
    api = mock.api
    tools = mock.tools
    registerKnowledgeTools(mock.agent)
  })

  // ── search_outdoor_guides ───────────────────────────────────────────────────

  describe('search_outdoor_guides', () => {
    it('is registered', () => {
      expect(tools.has('search_outdoor_guides')).toBe(true)
    })

    it('calls GET /ai/rag-search with query and limit', async () => {
      const guides = { results: [{ title: 'Bear Hang Guide', content: '...' }] }
      vi.mocked(api.get).mockResolvedValue(guides)

      const result = await callTool(tools, 'search_outdoor_guides', {
        query: 'how to set up a bear hang',
        limit: 3,
      })

      expect(api.get).toHaveBeenCalledWith('/ai/rag-search', {
        query: 'how to set up a bear hang',
        limit: 3,
      })
      expect(parseToolResult(result)).toEqual(guides)
    })

    it('returns error result on API failure', async () => {
      vi.mocked(api.get).mockRejectedValue(new ApiError('Service Unavailable', 503, {}))

      const result = await callTool(tools, 'search_outdoor_guides', {
        query: 'water treatment methods',
        limit: 5,
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('503')
    })
  })

  // ── web_search ──────────────────────────────────────────────────────────────

  describe('web_search', () => {
    it('is registered', () => {
      expect(tools.has('web_search')).toBe(true)
    })

    it('calls GET /ai/web-search with query', async () => {
      const webResult = { answer: 'JMT permits are available...', sources: [] }
      vi.mocked(api.get).mockResolvedValue(webResult)

      const result = await callTool(tools, 'web_search', {
        query: 'John Muir Trail permit availability 2025',
      })

      expect(api.get).toHaveBeenCalledWith('/ai/web-search', {
        query: 'John Muir Trail permit availability 2025',
      })
      expect(parseToolResult(result)).toEqual(webResult)
    })

    it('returns error when network fails', async () => {
      vi.mocked(api.get).mockRejectedValue(new Error('fetch failed'))

      const result = await callTool(tools, 'web_search', { query: 'test query' })

      expect(result.isError).toBe(true)
    })
  })

  // ── execute_sql_query ───────────────────────────────────────────────────────

  describe('execute_sql_query', () => {
    it('is registered', () => {
      expect(tools.has('execute_sql_query')).toBe(true)
    })

    it('calls POST /ai/execute-sql with query and limit', async () => {
      const rows = [{ name: 'Zpacks Duplex', weight: 510 }]
      vi.mocked(api.post).mockResolvedValue({ rows, rowCount: 1 })

      const sql = "SELECT name, weight FROM catalog_items WHERE category = 'tents' ORDER BY weight ASC LIMIT 5"
      const result = await callTool(tools, 'execute_sql_query', { query: sql, limit: 50 })

      const [path, body] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, unknown>]
      expect(path).toBe('/ai/execute-sql')
      expect(body.query).toBe(sql)
      expect(body.limit).toBe(50)
      expect((parseToolResult(result) as Record<string, unknown>).rowCount).toBe(1)
    })

    it('returns error for failed queries', async () => {
      vi.mocked(api.post).mockRejectedValue(new ApiError('Syntax error in SQL', 400, {}))

      const result = await callTool(tools, 'execute_sql_query', {
        query: 'SELECT * FROM nonexistent_table',
        limit: 100,
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('400')
    })
  })

  // ── get_database_schema ─────────────────────────────────────────────────────

  describe('get_database_schema', () => {
    it('is registered', () => {
      expect(tools.has('get_database_schema')).toBe(true)
    })

    it('calls GET /ai/db-schema with no params', async () => {
      const schema = { tables: [{ name: 'catalog_items', columns: ['id', 'name', 'weight'] }] }
      vi.mocked(api.get).mockResolvedValue(schema)

      const result = await callTool(tools, 'get_database_schema', {})

      expect(api.get).toHaveBeenCalledWith('/ai/db-schema')
      expect(parseToolResult(result)).toEqual(schema)
    })
  })
})
