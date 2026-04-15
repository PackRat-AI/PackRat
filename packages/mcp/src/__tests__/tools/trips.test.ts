import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../client'
import { registerTripTools } from '../../tools/trips'
import { buildMockAgent, callTool, parseToolResult } from '../helpers'
import type { PackRatApiClient } from '../../client'
import type { RegisteredTool } from '../helpers'

describe('trip tools', () => {
  let api: PackRatApiClient
  let tools: Map<string, RegisteredTool>

  beforeEach(() => {
    const mock = buildMockAgent()
    api = mock.api
    tools = mock.tools
    registerTripTools(mock.agent)
  })

  // ── list_trips ──────────────────────────────────────────────────────────────

  describe('list_trips', () => {
    it('is registered', () => {
      expect(tools.has('list_trips')).toBe(true)
    })

    it('calls GET /trips with limit and offset', async () => {
      vi.mocked(api.get).mockResolvedValue({ items: [] })

      await callTool(tools, 'list_trips', { limit: 10, offset: 20 })

      expect(api.get).toHaveBeenCalledWith('/trips', { limit: 10, offset: 20 })
    })

    it('returns error result on API failure', async () => {
      vi.mocked(api.get).mockRejectedValue(new Error('Network error'))

      const result = await callTool(tools, 'list_trips', { limit: 20, offset: 0 })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Network error')
    })
  })

  // ── get_trip ────────────────────────────────────────────────────────────────

  describe('get_trip', () => {
    it('calls GET /trips/:id', async () => {
      const trip = { id: 't_abc', name: 'JMT 2025' }
      vi.mocked(api.get).mockResolvedValue(trip)

      const result = await callTool(tools, 'get_trip', { trip_id: 't_abc' })

      expect(api.get).toHaveBeenCalledWith('/trips/t_abc')
      expect(parseToolResult(result)).toEqual(trip)
    })
  })

  // ── create_trip ─────────────────────────────────────────────────────────────

  describe('create_trip', () => {
    it('calls POST /trips with required fields and generated ID', async () => {
      const created = { id: 't_new', name: 'PCT Section J' }
      vi.mocked(api.post).mockResolvedValue(created)

      await callTool(tools, 'create_trip', {
        name: 'PCT Section J',
        description: 'Southern Sierra trip',
        start_date: '2025-09-01T00:00:00Z',
        end_date: '2025-09-07T00:00:00Z',
      })

      const [path, body] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, unknown>]
      expect(path).toBe('/trips')
      expect(body.name).toBe('PCT Section J')
      expect(body.description).toBe('Southern Sierra trip')
      expect(body.startDate).toBe('2025-09-01T00:00:00Z')
      expect(body.endDate).toBe('2025-09-07T00:00:00Z')
      expect(typeof body.id).toBe('string')
      expect((body.id as string).startsWith('t_')).toBe(true)
    })

    it('builds location object when lat/lng are provided', async () => {
      vi.mocked(api.post).mockResolvedValue({ id: 't_1' })

      await callTool(tools, 'create_trip', {
        name: 'Yosemite',
        latitude: 37.8651,
        longitude: -119.5383,
        location_name: 'Yosemite Valley',
      })

      const [, body] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, unknown>]
      const loc = body.location as Record<string, unknown>
      expect(loc).not.toBeNull()
      expect(loc.latitude).toBe(37.8651)
      expect(loc.longitude).toBe(-119.5383)
      expect(loc.name).toBe('Yosemite Valley')
    })

    it('sets location to null when no coordinates or name provided', async () => {
      vi.mocked(api.post).mockResolvedValue({ id: 't_2' })

      await callTool(tools, 'create_trip', { name: 'Nameless Trip' })

      const [, body] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, unknown>]
      expect(body.location).toBeNull()
    })
  })

  // ── update_trip ─────────────────────────────────────────────────────────────

  describe('update_trip', () => {
    it('calls PATCH /trips/:id with provided fields only', async () => {
      vi.mocked(api.patch).mockResolvedValue({ id: 't_1' })

      await callTool(tools, 'update_trip', {
        trip_id: 't_1',
        name: 'Renamed Trip',
        notes: 'Bring bear canister',
      })

      const [path, body] = vi.mocked(api.patch).mock.calls[0] as [string, Record<string, unknown>]
      expect(path).toBe('/trips/t_1')
      expect(body.name).toBe('Renamed Trip')
      expect(body.notes).toBe('Bring bear canister')
      expect(body.startDate).toBeUndefined()
    })

    it('builds location object when any location field is provided', async () => {
      vi.mocked(api.patch).mockResolvedValue({ id: 't_1' })

      await callTool(tools, 'update_trip', {
        trip_id: 't_1',
        location_name: 'New Location',
      })

      const [, body] = vi.mocked(api.patch).mock.calls[0] as [string, Record<string, unknown>]
      const loc = body.location as Record<string, unknown>
      expect(loc.name).toBe('New Location')
      expect(loc.latitude).toBe(0)
    })
  })

  // ── delete_trip ─────────────────────────────────────────────────────────────

  describe('delete_trip', () => {
    it('calls DELETE /trips/:id', async () => {
      vi.mocked(api.delete).mockResolvedValue({ deleted: true })

      const result = await callTool(tools, 'delete_trip', { trip_id: 't_del' })

      expect(api.delete).toHaveBeenCalledWith('/trips/t_del')
      expect(parseToolResult(result)).toEqual({ deleted: true })
    })

    it('returns error when API fails', async () => {
      vi.mocked(api.delete).mockRejectedValue(new ApiError('Forbidden', 403, {}))

      const result = await callTool(tools, 'delete_trip', { trip_id: 't_x' })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('403')
    })
  })
})
