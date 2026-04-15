import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../client'
import { registerTrailConditionTools } from '../../tools/trail-conditions'
import { buildMockAgent, callTool, parseToolResult } from '../helpers'
import type { PackRatApiClient } from '../../client'
import type { RegisteredTool } from '../helpers'

describe('trail condition tools', () => {
  let api: PackRatApiClient
  let tools: Map<string, RegisteredTool>

  beforeEach(() => {
    const mock = buildMockAgent()
    api = mock.api
    tools = mock.tools
    registerTrailConditionTools(mock.agent)
  })

  // ── get_trail_conditions ────────────────────────────────────────────────────

  describe('get_trail_conditions', () => {
    it('is registered', () => {
      expect(tools.has('get_trail_conditions')).toBe(true)
    })

    it('calls GET /trail-conditions with all params', async () => {
      const reports = { items: [{ id: 1, condition: 'good' }] }
      vi.mocked(api.get).mockResolvedValue(reports)

      const result = await callTool(tools, 'get_trail_conditions', {
        trail_name: 'John Muir Trail',
        latitude: 37.3861,
        longitude: -118.5982,
        radius_km: 50,
        limit: 5,
      })

      expect(api.get).toHaveBeenCalledWith('/trail-conditions', {
        trailName: 'John Muir Trail',
        latitude: 37.3861,
        longitude: -118.5982,
        radiusKm: 50,
        limit: 5,
      })
      expect(parseToolResult(result)).toEqual(reports)
    })

    it('works with only trail_name (no coordinates)', async () => {
      vi.mocked(api.get).mockResolvedValue({ items: [] })

      await callTool(tools, 'get_trail_conditions', {
        trail_name: 'Half Dome',
        radius_km: 25,
        limit: 10,
      })

      const [, params] = vi.mocked(api.get).mock.calls[0] as [string, Record<string, unknown>]
      expect(params.trailName).toBe('Half Dome')
      expect(params.latitude).toBeUndefined()
      expect(params.longitude).toBeUndefined()
    })

    it('returns error result on API failure', async () => {
      vi.mocked(api.get).mockRejectedValue(new ApiError('Internal Server Error', 500, {}))

      const result = await callTool(tools, 'get_trail_conditions', {
        radius_km: 25,
        limit: 10,
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('500')
    })
  })

  // ── submit_trail_condition ──────────────────────────────────────────────────

  describe('submit_trail_condition', () => {
    it('is registered', () => {
      expect(tools.has('submit_trail_condition')).toBe(true)
    })

    it('calls POST /trail-conditions with all fields mapped correctly', async () => {
      vi.mocked(api.post).mockResolvedValue({ id: 'tc_1', submitted: true })

      const result = await callTool(tools, 'submit_trail_condition', {
        trail_name: 'Mt Whitney Trail',
        latitude: 36.5785,
        longitude: -118.2923,
        condition: 'good',
        report_date: '2025-07-20T10:00:00Z',
        notes: 'Trail is clear above 10k, some snow patches near the summit',
        hazards: ['snow', 'rockfall'],
        water_crossings: 'low',
        snow_depth_cm: 15,
      })

      const [path, body] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, unknown>]
      expect(path).toBe('/trail-conditions')
      expect(body.trailName).toBe('Mt Whitney Trail')
      expect(body.latitude).toBe(36.5785)
      expect(body.longitude).toBe(-118.2923)
      expect(body.condition).toBe('good')
      expect(body.reportDate).toBe('2025-07-20T10:00:00Z')
      expect(body.notes).toContain('summit')
      expect(body.hazards).toEqual(['snow', 'rockfall'])
      expect(body.waterCrossings).toBe('low')
      expect(body.snowDepthCm).toBe(15)
      expect(parseToolResult(result)).toEqual({ id: 'tc_1', submitted: true })
    })

    it('submits with optional fields absent', async () => {
      vi.mocked(api.post).mockResolvedValue({ id: 'tc_2' })

      await callTool(tools, 'submit_trail_condition', {
        trail_name: 'Simple Trail',
        latitude: 40.0,
        longitude: -120.0,
        condition: 'excellent',
        report_date: '2025-08-01T00:00:00Z',
      })

      const [, body] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, unknown>]
      expect(body.hazards).toBeUndefined()
      expect(body.waterCrossings).toBeUndefined()
      expect(body.snowDepthCm).toBeUndefined()
      expect(body.notes).toBeUndefined()
    })

    it('returns error when user is not authenticated (401)', async () => {
      vi.mocked(api.post).mockRejectedValue(new ApiError('Unauthorized', 401, {}))

      const result = await callTool(tools, 'submit_trail_condition', {
        trail_name: 'Test Trail',
        latitude: 0,
        longitude: 0,
        condition: 'fair',
        report_date: '2025-01-01T00:00:00Z',
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('401')
    })
  })
})
