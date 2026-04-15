import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../client'
import { registerPackTools } from '../../tools/packs'
import { buildMockAgent, callTool, parseToolResult } from '../helpers'
import type { PackRatApiClient } from '../../client'
import type { RegisteredTool } from '../helpers'

describe('pack tools', () => {
  let api: PackRatApiClient
  let tools: Map<string, RegisteredTool>

  beforeEach(() => {
    const mock = buildMockAgent()
    api = mock.api
    tools = mock.tools
    registerPackTools(mock.agent)
  })

  // ── list_packs ──────────────────────────────────────────────────────────────

  describe('list_packs', () => {
    it('is registered', () => {
      expect(tools.has('list_packs')).toBe(true)
    })

    it('calls GET /packs with limit, offset, category', async () => {
      const mockData = { items: [], total: 0 }
      vi.mocked(api.get).mockResolvedValue(mockData)

      const result = await callTool(tools, 'list_packs', { limit: 5, offset: 10, category: 'backpacking' })

      expect(api.get).toHaveBeenCalledWith('/packs', { limit: 5, offset: 10, category: 'backpacking' })
      expect(parseToolResult(result)).toEqual(mockData)
    })

    it('returns error result on API failure', async () => {
      vi.mocked(api.get).mockRejectedValue(new ApiError('Forbidden', 403, {}))

      const result = await callTool(tools, 'list_packs', { limit: 20, offset: 0 })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('403')
    })
  })

  // ── get_pack ────────────────────────────────────────────────────────────────

  describe('get_pack', () => {
    it('calls GET /packs/:id', async () => {
      const pack = { id: 'p_abc', name: 'Test Pack', items: [] }
      vi.mocked(api.get).mockResolvedValue(pack)

      const result = await callTool(tools, 'get_pack', { pack_id: 'p_abc' })

      expect(api.get).toHaveBeenCalledWith('/packs/p_abc')
      expect(parseToolResult(result)).toEqual(pack)
    })

    it('propagates 404 as error result', async () => {
      vi.mocked(api.get).mockRejectedValue(new ApiError('Not Found', 404, {}))

      const result = await callTool(tools, 'get_pack', { pack_id: 'nope' })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('404')
    })
  })

  // ── create_pack ─────────────────────────────────────────────────────────────

  describe('create_pack', () => {
    it('calls POST /packs with mapped fields', async () => {
      const created = { id: 'p_new', name: 'Summer Trek' }
      vi.mocked(api.post).mockResolvedValue(created)

      const result = await callTool(tools, 'create_pack', {
        name: 'Summer Trek',
        category: 'backpacking',
        is_public: true,
        tags: ['summer', 'california'],
      })

      expect(api.post).toHaveBeenCalledOnce()
      const [path, body] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, unknown>]
      expect(path).toBe('/packs')
      expect(body.name).toBe('Summer Trek')
      expect(body.category).toBe('backpacking')
      expect(body.isPublic).toBe(true)
      expect(body.tags).toEqual(['summer', 'california'])
      expect(typeof body.id).toBe('string')
      expect((body.id as string).startsWith('p_')).toBe(true)
      expect(parseToolResult(result)).toEqual(created)
    })
  })

  // ── update_pack ─────────────────────────────────────────────────────────────

  describe('update_pack', () => {
    it('calls PATCH /packs/:id with only provided fields', async () => {
      vi.mocked(api.patch).mockResolvedValue({ id: 'p_1' })

      await callTool(tools, 'update_pack', {
        pack_id: 'p_1',
        name: 'Renamed Pack',
        is_public: false,
      })

      const [path, body] = vi.mocked(api.patch).mock.calls[0] as [string, Record<string, unknown>]
      expect(path).toBe('/packs/p_1')
      expect(body.name).toBe('Renamed Pack')
      expect(body.isPublic).toBe(false)
      expect(body.category).toBeUndefined()
    })

    it('does not include undefined optional fields', async () => {
      vi.mocked(api.patch).mockResolvedValue({ id: 'p_1' })

      await callTool(tools, 'update_pack', { pack_id: 'p_1', name: 'Only Name' })

      const [, body] = vi.mocked(api.patch).mock.calls[0] as [string, Record<string, unknown>]
      expect(body.description).toBeUndefined()
      expect(body.tags).toBeUndefined()
    })
  })

  // ── delete_pack ─────────────────────────────────────────────────────────────

  describe('delete_pack', () => {
    it('calls DELETE /packs/:id', async () => {
      vi.mocked(api.delete).mockResolvedValue({ deleted: true })

      const result = await callTool(tools, 'delete_pack', { pack_id: 'p_del' })

      expect(api.delete).toHaveBeenCalledWith('/packs/p_del')
      expect(parseToolResult(result)).toEqual({ deleted: true })
    })
  })

  // ── add_pack_item ───────────────────────────────────────────────────────────

  describe('add_pack_item', () => {
    it('calls POST /packs/:id/items with mapped fields', async () => {
      vi.mocked(api.post).mockResolvedValue({ id: 'i_new' })

      await callTool(tools, 'add_pack_item', {
        pack_id: 'p_1',
        name: 'Down Sleeping Bag',
        category: 'sleep',
        weight_grams: 900,
        quantity: 1,
        is_consumable: false,
        is_worn: false,
      })

      const [path, body] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, unknown>]
      expect(path).toBe('/packs/p_1/items')
      expect(body.name).toBe('Down Sleeping Bag')
      expect(body.weight).toBe(900)
      expect(body.category).toBe('sleep')
      expect(body.quantity).toBe(1)
      expect(typeof body.id).toBe('string')
    })
  })

  // ── remove_pack_item ────────────────────────────────────────────────────────

  describe('remove_pack_item', () => {
    it('calls DELETE /packs/:id/items/:itemId', async () => {
      vi.mocked(api.delete).mockResolvedValue({ deleted: true })

      await callTool(tools, 'remove_pack_item', { pack_id: 'p_1', item_id: 'i_99' })

      expect(api.delete).toHaveBeenCalledWith('/packs/p_1/items/i_99')
    })
  })

  // ── generate_pack ───────────────────────────────────────────────────────────

  describe('generate_pack', () => {
    it('calls POST /packs/generate', async () => {
      vi.mocked(api.post).mockResolvedValue({ packs: [] })

      await callTool(tools, 'generate_pack', {
        trip_description: '3-day winter backpacking in Sierras',
        count: 2,
      })

      const [path, body] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, unknown>]
      expect(path).toBe('/packs/generate')
      expect(body.description).toBe('3-day winter backpacking in Sierras')
      expect(body.count).toBe(2)
    })
  })

  // ── analyze_pack_weight ─────────────────────────────────────────────────────

  describe('analyze_pack_weight', () => {
    it('computes per-category weight breakdown', async () => {
      vi.mocked(api.get).mockResolvedValue({
        totalWeight: 3200,
        baseWeight: 2800,
        wornWeight: 400,
        consumableWeight: 0,
        items: [
          { name: 'Tent', category: 'shelter', weight: 1200, quantity: 1, worn: false, consumable: false },
          { name: 'Sleeping Bag', category: 'sleep', weight: 900, quantity: 1, worn: false, consumable: false },
          { name: 'Jacket', category: 'clothing', weight: 400, quantity: 1, worn: true, consumable: false },
          { name: 'Stove', category: 'kitchen', weight: 400, quantity: 2, worn: false, consumable: false },
        ],
      })

      const result = await callTool(tools, 'analyze_pack_weight', { pack_id: 'p_1' })
      const analysis = parseToolResult(result) as Record<string, unknown>

      expect(analysis.packId).toBe('p_1')
      expect(analysis.totalWeight).toBe(3200)
      expect(analysis.itemCount).toBe(4)

      const categories = (analysis.byCategory as Array<Record<string, unknown>>)
      // shelter (1200g) should be first
      expect(categories[0].category).toBe('shelter')
      expect(categories[0].totalGrams).toBe(1200)
      // kitchen has 2×400 = 800g
      const kitchen = categories.find((c) => c.category === 'kitchen')
      expect(kitchen?.totalGrams).toBe(800)
    })

    it('handles empty items array gracefully', async () => {
      vi.mocked(api.get).mockResolvedValue({ items: [] })

      const result = await callTool(tools, 'analyze_pack_weight', { pack_id: 'p_empty' })
      const analysis = parseToolResult(result) as Record<string, unknown>

      expect(analysis.itemCount).toBe(0)
      expect((analysis.byCategory as unknown[]).length).toBe(0)
    })
  })

  // ── analyze_pack_gaps ───────────────────────────────────────────────────────

  describe('analyze_pack_gaps', () => {
    it('calls POST /packs/:id/gap-analysis', async () => {
      vi.mocked(api.post).mockResolvedValue({ missing: ['first_aid', 'navigation'] })

      const result = await callTool(tools, 'analyze_pack_gaps', {
        pack_id: 'p_1',
        activity: 'backpacking',
        duration_days: 3,
      })

      const [path, body] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, unknown>]
      expect(path).toBe('/packs/p_1/gap-analysis')
      expect(body.activity).toBe('backpacking')
      expect(body.durationDays).toBe(3)
      expect(parseToolResult(result)).toEqual({ missing: ['first_aid', 'navigation'] })
    })
  })
})
