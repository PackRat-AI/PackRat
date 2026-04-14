import { z } from 'zod'
import { err, ok } from '../client'
import type { PackRatMCP } from '../index'

export function registerWeatherTools(agent: PackRatMCP): void {
  // ── Get weather ───────────────────────────────────────────────────────────

  agent.server.registerTool(
    'get_weather',
    {
      description:
        'Get current weather conditions and multi-day forecast for any location. Returns temperature, precipitation, wind, humidity, and outdoor conditions relevant to trip planning. Works with city names, trail names, park names, or coordinates.',
      inputSchema: {
        location: z
          .string()
          .min(2)
          .describe(
            'Location to get weather for. Examples: "Yosemite Valley, CA", "Mt. Whitney Summit", "Seattle, WA", "37.8651,-119.5383"',
          ),
      },
    },
    async ({ location }) => {
      try {
        const data = await agent.api.get('/weather', { location })
        return ok(data)
      } catch (e) {
        return err(e)
      }
    },
  )

  // ── Season suggestion ─────────────────────────────────────────────────────

  agent.server.registerTool(
    'get_season_suggestions',
    {
      description:
        'Get AI-powered suggestions for the best seasons to visit a destination and recommended activities per season. Useful for trip planning.',
      inputSchema: {
        destination: z
          .string()
          .min(2)
          .describe(
            'Destination to get season suggestions for (e.g. "Patagonia", "Zion National Park")',
          ),
      },
    },
    async ({ destination }) => {
      try {
        const data = await agent.api.get('/season-suggestions', { destination })
        return ok(data)
      } catch (e) {
        return err(e)
      }
    },
  )
}
