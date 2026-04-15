import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../client'
import { registerWeatherTools } from '../../tools/weather'
import { buildMockAgent, callTool, parseToolResult } from '../helpers'
import type { PackRatApiClient } from '../../client'
import type { RegisteredTool } from '../helpers'

describe('weather tools', () => {
  let api: PackRatApiClient
  let tools: Map<string, RegisteredTool>

  beforeEach(() => {
    const mock = buildMockAgent()
    api = mock.api
    tools = mock.tools
    registerWeatherTools(mock.agent)
  })

  // ── get_weather ─────────────────────────────────────────────────────────────

  describe('get_weather', () => {
    it('is registered', () => {
      expect(tools.has('get_weather')).toBe(true)
    })

    it('calls GET /weather with location param', async () => {
      const weather = { location: 'Yosemite', temp: 55, forecast: [] }
      vi.mocked(api.get).mockResolvedValue(weather)

      const result = await callTool(tools, 'get_weather', { location: 'Yosemite Valley, CA' })

      expect(api.get).toHaveBeenCalledWith('/weather', { location: 'Yosemite Valley, CA' })
      expect(parseToolResult(result)).toEqual(weather)
    })

    it('returns error result when API fails', async () => {
      vi.mocked(api.get).mockRejectedValue(new ApiError('Bad Request', 400, {}))

      const result = await callTool(tools, 'get_weather', { location: '' })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('400')
    })
  })

  // ── get_season_suggestions ──────────────────────────────────────────────────

  describe('get_season_suggestions', () => {
    it('is registered', () => {
      expect(tools.has('get_season_suggestions')).toBe(true)
    })

    it('calls GET /season-suggestions with destination param', async () => {
      const suggestions = {
        destination: 'Patagonia',
        seasons: [{ name: 'Summer', months: 'Dec-Feb', conditions: 'best' }],
      }
      vi.mocked(api.get).mockResolvedValue(suggestions)

      const result = await callTool(tools, 'get_season_suggestions', { destination: 'Patagonia' })

      expect(api.get).toHaveBeenCalledWith('/season-suggestions', { destination: 'Patagonia' })
      expect(parseToolResult(result)).toEqual(suggestions)
    })

    it('returns error when API fails', async () => {
      vi.mocked(api.get).mockRejectedValue(new Error('Timeout'))

      const result = await callTool(tools, 'get_season_suggestions', { destination: 'Nowhere' })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Timeout')
    })
  })
})
