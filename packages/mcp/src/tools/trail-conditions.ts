import { z } from 'zod';
import { call, nowIso } from '../client';
import { CrossingDifficulty, TrailCondition, TrailSurface } from '../enums';
import type { AgentContext } from '../types';

export function registerTrailConditionTools(agent: AgentContext): void {
  // ── List trail condition reports ──────────────────────────────────────────

  agent.server.registerTool(
    'get_trail_conditions',
    {
      description:
        'Get user-submitted trail condition reports. Filter by trail name to find reports for a specific trail or area.',
      inputSchema: {
        trail_name: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(20),
      },
    },
    async ({ trail_name, limit }) =>
      call(
        agent.api.user['trail-conditions'].get({
          query: { trailName: trail_name, limit },
        }),
        { action: 'list trail conditions' },
      ),
  );

  // ── List user's own trail reports ─────────────────────────────────────────

  agent.server.registerTool(
    'list_my_trail_reports',
    {
      description: 'List trail condition reports authored by the signed-in user.',
      inputSchema: {
        updated_since: z
          .string()
          .optional()
          .describe('Only include reports updated after this ISO timestamp'),
      },
    },
    async ({ updated_since }) =>
      call(
        agent.api.user['trail-conditions'].mine.get({
          query: updated_since ? { updatedAt: updated_since } : {},
        }),
        { action: 'list my trail reports' },
      ),
  );

  // ── Submit trail condition ────────────────────────────────────────────────

  agent.server.registerTool(
    'submit_trail_condition',
    {
      description:
        'Submit a trail condition report to help the community. Requires user authentication.',
      inputSchema: {
        trail_name: z.string().min(1),
        trail_region: z.string().optional(),
        surface: z.nativeEnum(TrailSurface),
        overall_condition: z.nativeEnum(TrailCondition),
        hazards: z.array(z.string()).optional(),
        water_crossings: z.number().int().min(0).max(20).optional(),
        water_crossing_difficulty: z.nativeEnum(CrossingDifficulty).optional(),
        notes: z.string().optional(),
        photos: z.array(z.string()).optional(),
        trip_id: z.string().optional(),
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
      photos,
      trip_id,
    }) => {
      const now = nowIso();
      return call(
        agent.api.user['trail-conditions'].post({
          trailName: trail_name,
          trailRegion: trail_region ?? null,
          surface,
          overallCondition: overall_condition,
          hazards: hazards ?? [],
          waterCrossings: water_crossings ?? 0,
          waterCrossingDifficulty: water_crossing_difficulty ?? null,
          notes: notes ?? null,
          photos: photos ?? [],
          tripId: trip_id,
          localCreatedAt: now,
          localUpdatedAt: now,
        }),
        { action: 'submit trail condition report' },
      );
    },
  );

  // ── Update trail report ───────────────────────────────────────────────────

  agent.server.registerTool(
    'update_trail_condition',
    {
      description: 'Update one of your own trail condition reports.',
      inputSchema: {
        report_id: z.string(),
        trail_name: z.string().optional(),
        trail_region: z.string().nullable().optional(),
        surface: z.nativeEnum(TrailSurface).optional(),
        overall_condition: z.nativeEnum(TrailCondition).optional(),
        hazards: z.array(z.string()).optional(),
        water_crossings: z.number().int().min(0).max(20).optional(),
        water_crossing_difficulty: z.nativeEnum(CrossingDifficulty).nullable().optional(),
        notes: z.string().nullable().optional(),
        photos: z.array(z.string()).optional(),
      },
    },
    async ({
      report_id,
      trail_name,
      trail_region,
      surface,
      overall_condition,
      hazards,
      water_crossings,
      water_crossing_difficulty,
      notes,
      photos,
    }) => {
      const body: Record<string, unknown> = { localUpdatedAt: nowIso() };
      if (trail_name !== undefined) body.trailName = trail_name;
      if (trail_region !== undefined) body.trailRegion = trail_region;
      if (surface !== undefined) body.surface = surface;
      if (overall_condition !== undefined) body.overallCondition = overall_condition;
      if (hazards !== undefined) body.hazards = hazards;
      if (water_crossings !== undefined) body.waterCrossings = water_crossings;
      if (water_crossing_difficulty !== undefined) {
        body.waterCrossingDifficulty = water_crossing_difficulty;
      }
      if (notes !== undefined) body.notes = notes;
      if (photos !== undefined) body.photos = photos;
      return call(agent.api.user['trail-conditions']({ reportId: report_id }).put(body), {
        action: 'update trail report',
        resourceHint: `report ${report_id}`,
      });
    },
  );

  // ── Delete trail report ───────────────────────────────────────────────────

  agent.server.registerTool(
    'delete_trail_condition',
    {
      description: 'Soft-delete one of your trail condition reports.',
      inputSchema: { report_id: z.string() },
    },
    async ({ report_id }) =>
      call(agent.api.user['trail-conditions']({ reportId: report_id }).delete(), {
        action: 'delete trail report',
        resourceHint: `report ${report_id}`,
      }),
  );
}
