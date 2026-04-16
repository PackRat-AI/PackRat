import { z } from 'zod';
import { err, ok } from '../client';
import { ApiRoute } from '../constants';
import { CrossingDifficulty, TrailCondition, TrailSurface } from '../enums';
import type { AgentContext } from '../types';

export function registerTrailConditionTools(agent: AgentContext): void {
  // ── Get trail conditions ──────────────────────────────────────────────────

  agent.server.registerTool(
    'get_trail_conditions',
    {
      description:
        'Get user-submitted trail condition reports. Filter by trail name to find reports for a specific trail or area. Reports include overall condition, surface type, hazards, water crossings, and notes.',
      inputSchema: {
        trail_name: z
          .string()
          .optional()
          .describe('Trail or area name to search for (e.g. "John Muir Trail", "Half Dome")'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(20)
          .describe('Maximum reports to return (default 20)'),
      },
    },
    async ({ trail_name, limit }) => {
      try {
        const data = await agent.api.get(ApiRoute.TrailConditions, {
          trailName: trail_name,
          limit,
        });
        return ok(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── Submit trail condition ────────────────────────────────────────────────

  agent.server.registerTool(
    'submit_trail_condition',
    {
      description:
        'Submit a trail condition report to help the community. Provide your observations about current trail surface, overall condition, hazards, and water crossings. Requires user authentication.',
      inputSchema: {
        trail_name: z.string().min(1).describe('Name of the trail or area'),
        trail_region: z
          .string()
          .optional()
          .describe('Region or state (e.g. "California", "Maine")'),
        surface: z.nativeEnum(TrailSurface).describe('Current trail surface type'),
        overall_condition: z.nativeEnum(TrailCondition).describe('Overall trail condition'),
        hazards: z
          .array(z.string())
          .optional()
          .describe(
            'List of current hazards (e.g. ["loose rocks", "fallen trees", "slippery surface"])',
          ),
        water_crossings: z
          .number()
          .int()
          .min(0)
          .max(20)
          .optional()
          .describe('Number of water crossings on the trail (0–20)'),
        water_crossing_difficulty: z
          .nativeEnum(CrossingDifficulty)
          .optional()
          .describe('Difficulty of water crossings if present'),
        notes: z
          .string()
          .optional()
          .describe('Detailed observations about conditions, hazards, or recommendations'),
      },
    },
    async ({
      trail_name,
      trail_region,
      surface,
      overall_condition,
      hazards,
      water_crossings,
      water_crossing_difficulty,
      notes,
    }) => {
      try {
        const id = `tcr_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
        const now = new Date().toISOString();
        const data = await agent.api.post(ApiRoute.TrailConditions, {
          id,
          trailName: trail_name,
          trailRegion: trail_region ?? null,
          surface,
          overallCondition: overall_condition,
          hazards: hazards ?? [],
          waterCrossings: water_crossings ?? 0,
          waterCrossingDifficulty: water_crossing_difficulty ?? null,
          notes: notes ?? null,
          photos: [],
          localCreatedAt: now,
          localUpdatedAt: now,
        });
        return ok(data);
      } catch (e) {
        return err(e);
      }
    },
  );
}
