import { z } from 'zod';
import { call, clampLimit, nowIso, ok, PAGINATION_LIMIT_MAX, withNextOffset } from '../client';
import { GetTripOutputSchema, ListTripsOutputSchema } from '../output-schemas';
import type { AgentContext } from '../types';

const LocationInput = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  name: z.string().optional(),
});

export function registerTripTools(agent: AgentContext): void {
  // ── List trips ────────────────────────────────────────────────────────────

  agent.server.registerTool(
    'packrat_list_trips',
    {
      title: 'List My Trips',
      description:
        `List all of the user's planned trips. Returns trip summaries including name, destination, dates, and linked pack. ` +
        `Paginated: results are capped at ${PAGINATION_LIMIT_MAX} per call; the response includes a \`nextOffset\` value (or \`null\` at the end) for continuation.`,
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe(`Page size (clamped to ${PAGINATION_LIMIT_MAX} server-side).`),
        offset: z
          .number()
          .int()
          .min(0)
          .default(0)
          .describe('Pagination offset; use `nextOffset` from the previous response.'),
      },
      // U8: tier-1 structured output — list of Trip with nextOffset.
      outputSchema: ListTripsOutputSchema.shape,
      annotations: {
        title: 'List My Trips',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ limit, offset }) => {
      const clamped = clampLimit(limit);
      const result = await agent.api.user.trips.get();
      if (result.error || result.data == null) {
        return call({ promise: Promise.resolve(result), action: 'list trips' });
      }
      const items = Array.isArray(result.data) ? result.data : [];
      const page = items.slice(offset, offset + clamped);
      return ok(withNextOffset({ items: page, offset, limit: clamped }), { structured: true });
    },
  );

  // ── Get trip ──────────────────────────────────────────────────────────────

  agent.server.registerTool(
    'packrat_get_trip',
    {
      title: 'Get Trip',
      description:
        'Get full details for a single trip including location coordinates, dates, notes, and linked pack information.',
      inputSchema: { trip_id: z.string().describe('The unique trip ID (e.g. "t_abc123")') },
      // U8: tier-1 structured output — Trip shape.
      outputSchema: GetTripOutputSchema.shape,
      annotations: {
        title: 'Get Trip',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ trip_id }) =>
      call({
        promise: agent.api.user.trips({ tripId: trip_id }).get(),
        action: 'get trip',
        resourceHint: `trip ${trip_id}`,
        structured: true,
      }),
  );

  // ── Create trip ───────────────────────────────────────────────────────────

  agent.server.registerTool(
    'packrat_create_trip',
    {
      title: 'Create Trip',
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
      annotations: {
        title: 'Create Trip',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ name, description, location, start_date, end_date, notes, pack_id }) => {
      const now = nowIso();
      return call({
        promise: agent.api.user.trips.post({
          id: crypto.randomUUID(),
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
        action: 'create trip',
      });
    },
  );

  // ── Update trip ───────────────────────────────────────────────────────────

  agent.server.registerTool(
    'packrat_update_trip',
    {
      title: 'Update Trip',
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
      annotations: {
        title: 'Update Trip',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
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
      return call({
        promise: agent.api.user.trips({ tripId: trip_id }).put(body),
        action: 'update trip',
        resourceHint: `trip ${trip_id}`,
      });
    },
  );

  // ── Delete trip ───────────────────────────────────────────────────────────

  agent.server.registerTool(
    'packrat_delete_trip',
    {
      title: 'Delete Trip',
      description: 'Delete a trip. The trip will no longer appear in listings.',
      inputSchema: { trip_id: z.string() },
      annotations: {
        title: 'Delete Trip',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ trip_id }) =>
      call({
        promise: agent.api.user.trips({ tripId: trip_id }).delete(),
        action: 'delete trip',
        resourceHint: `trip ${trip_id}`,
      }),
  );
}
