import { z } from 'zod'
import { err, ok } from '../client'
import type { PackRatMCP } from '../index'

export function registerTrailConditionTools(agent: PackRatMCP): void {
  // ── Get trail conditions ──────────────────────────────────────────────────

  agent.server.registerTool(
    'get_trail_conditions',
    {
      description:
        'Get user-submitted trail condition reports for a location or trail. Reports include current conditions (trail quality, snow, mud, obstacles), hazards, water sources, and recent observations. Useful for planning or pre-trip checks.',
      inputSchema: {
        trail_name: z
          .string()
          .optional()
          .describe('Trail or area name to search for (e.g. "John Muir Trail", "Half Dome")'),
        latitude: z.number().min(-90).max(90).optional().describe('Location latitude'),
        longitude: z.number().min(-180).max(180).optional().describe('Location longitude'),
        radius_km: z
          .number()
          .min(1)
          .max(100)
          .default(25)
          .describe('Search radius in km around coordinates (default 25)'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(10)
          .describe('Maximum reports to return'),
      },
    },
    async ({ trail_name, latitude, longitude, radius_km, limit }) => {
      try {
        const data = await agent.api.get('/trail-conditions', {
          trailName: trail_name,
          latitude,
          longitude,
          radiusKm: radius_km,
          limit,
        })
        return ok(data)
      } catch (e) {
        return err(e)
      }
    },
  )

  // ── Submit trail condition ────────────────────────────────────────────────

  agent.server.registerTool(
    'submit_trail_condition',
    {
      description:
        'Submit a trail condition report to help the community. Provide your observations about current conditions, hazards, and recommendations. Requires user authentication.',
      inputSchema: {
        trail_name: z.string().min(2).describe('Name of the trail or area'),
        latitude: z.number().min(-90).max(90).describe('Location latitude'),
        longitude: z.number().min(-180).max(180).describe('Location longitude'),
        condition: z
          .enum(['excellent', 'good', 'fair', 'poor', 'impassable'])
          .describe('Overall trail condition'),
        report_date: z
          .string()
          .describe('Date of observation in ISO 8601 format (e.g. "2025-07-15T10:00:00Z")'),
        notes: z
          .string()
          .optional()
          .describe('Detailed observations about conditions, hazards, or recommendations'),
        hazards: z
          .array(
            z.enum([
              'snow',
              'ice',
              'flooding',
              'fallen_trees',
              'wildlife',
              'washed_out',
              'overgrown',
              'rockfall',
            ]),
          )
          .optional()
          .describe('Current hazards on the trail'),
        water_crossings: z
          .enum(['dry', 'low', 'moderate', 'high', 'impassable'])
          .optional()
          .describe('Water crossing conditions if applicable'),
        snow_depth_cm: z
          .number()
          .min(0)
          .optional()
          .describe('Snow depth in centimeters if snow is present'),
      },
    },
    async ({
      trail_name,
      latitude,
      longitude,
      condition,
      report_date,
      notes,
      hazards,
      water_crossings,
      snow_depth_cm,
    }) => {
      try {
        const data = await agent.api.post('/trail-conditions', {
          trailName: trail_name,
          latitude,
          longitude,
          condition,
          reportDate: report_date,
          notes,
          hazards,
          waterCrossings: water_crossings,
          snowDepthCm: snow_depth_cm,
        })
        return ok(data)
      } catch (e) {
        return err(e)
      }
    },
  )
}
