import { z } from 'zod';
import { call, nowIso, shortId } from '../client';
import type { AgentContext } from '../types';

const LocationInput = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  name: z.string().optional(),
});

export function registerTripTools(agent: AgentContext): void {
  // ── List trips ────────────────────────────────────────────────────────────

  agent.server.registerTool(
    'list_trips',
    {
      description:
        "List all of the user's planned trips. Returns trip summaries including name, destination, dates, and linked pack.",
      inputSchema: {},
    },
    async () => call(agent.api.user.trips.get(), { action: 'list trips' }),
  );

  // ── Get trip ──────────────────────────────────────────────────────────────

  agent.server.registerTool(
    'get_trip',
    {
      description:
        'Get full details for a single trip including location coordinates, dates, notes, and linked pack information.',
      inputSchema: { trip_id: z.string().describe('The unique trip ID (e.g. "t_abc123")') },
    },
    async ({ trip_id }) =>
      call(agent.api.user.trips({ tripId: trip_id }).get(), {
        action: 'get trip',
        resourceHint: `trip ${trip_id}`,
      }),
  );

  // ── Create trip ───────────────────────────────────────────────────────────

  agent.server.registerTool(
    'create_trip',
    {
      description:
        'Create a new trip plan with destination, dates, and optional link to a pack. Returns the created trip with its ID.',
      inputSchema: {
        name: z.string().min(1).describe('Trip name (e.g. "PCT Section J — Fall 2025")'),
        description: z.string().optional().describe('Trip description or notes'),
        location: LocationInput.optional().describe('Optional structured location'),
        start_date: z.string().optional().describe('Trip start date in ISO 8601 format'),
        end_date: z.string().optional().describe('Trip end date in ISO 8601 format'),
        notes: z.string().optional().describe('Planning notes, permits needed, logistics'),
        pack_id: z.string().optional().describe('Optionally link an existing pack to this trip'),
      },
    },
    async ({ name, description, location, start_date, end_date, notes, pack_id }) => {
      const id = shortId('t');
      const now = nowIso();
      return call(
        agent.api.user.trips.post({
          id,
          name,
          description,
          location: location ?? null,
          startDate: start_date,
          endDate: end_date,
          notes,
          packId: pack_id,
          localCreatedAt: now,
          localUpdatedAt: now,
        }),
        { action: 'create trip' },
      );
    },
  );

  // ── Update trip ───────────────────────────────────────────────────────────

  agent.server.registerTool(
    'update_trip',
    {
      description: "Update an existing trip's details, dates, location, or linked pack.",
      inputSchema: {
        trip_id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        location: LocationInput.nullable().optional(),
        start_date: z.string().nullable().optional(),
        end_date: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        pack_id: z.string().nullable().optional(),
      },
    },
    async ({ trip_id, name, description, location, start_date, end_date, notes, pack_id }) => {
      const body: Record<string, unknown> = { localUpdatedAt: nowIso() };
      if (name !== undefined) body.name = name;
      if (description !== undefined) body.description = description;
      if (location !== undefined) body.location = location;
      if (start_date !== undefined) body.startDate = start_date;
      if (end_date !== undefined) body.endDate = end_date;
      if (notes !== undefined) body.notes = notes;
      if (pack_id !== undefined) body.packId = pack_id;
      return call(agent.api.user.trips({ tripId: trip_id }).put(body), {
        action: 'update trip',
        resourceHint: `trip ${trip_id}`,
      });
    },
  );

  // ── Delete trip ───────────────────────────────────────────────────────────

  agent.server.registerTool(
    'delete_trip',
    {
      description: 'Delete a trip. The trip will no longer appear in listings.',
      inputSchema: { trip_id: z.string() },
    },
    async ({ trip_id }) =>
      call(agent.api.user.trips({ tripId: trip_id }).delete(), {
        action: 'delete trip',
        resourceHint: `trip ${trip_id}`,
      }),
  );
}
