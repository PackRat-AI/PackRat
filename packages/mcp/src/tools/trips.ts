import { z } from 'zod';
import { err, ok } from '../client';
import { ApiRoute } from '../constants';
import type { AgentContext } from '../types';

export function registerTripTools(agent: AgentContext): void {
  // ── List trips ────────────────────────────────────────────────────────────

  agent.server.registerTool(
    'list_trips',
    {
      description:
        "List all of the user's planned trips. Returns trip summaries including name, destination, dates, and linked pack.",
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(20)
          .describe('Maximum number of trips to return'),
        offset: z.number().int().min(0).default(0).describe('Pagination offset'),
      },
    },
    async ({ limit, offset }) => {
      try {
        const data = await agent.api.get(ApiRoute.Trips, { limit, offset });
        return ok(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── Get trip ──────────────────────────────────────────────────────────────

  agent.server.registerTool(
    'get_trip',
    {
      description:
        'Get full details for a single trip including location coordinates, dates, notes, and linked pack information.',
      inputSchema: {
        trip_id: z.string().describe('The unique trip ID (e.g. "t_abc123")'),
      },
    },
    async ({ trip_id }) => {
      try {
        const data = await agent.api.get(`${ApiRoute.Trips}/${trip_id}`);
        return ok(data);
      } catch (e) {
        return err(e);
      }
    },
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
        location_name: z
          .string()
          .optional()
          .describe('Human-readable location name (e.g. "John Muir Trail, CA")'),
        latitude: z.number().min(-90).max(90).optional().describe('Location latitude'),
        longitude: z.number().min(-180).max(180).optional().describe('Location longitude'),
        start_date: z
          .string()
          .optional()
          .describe('Trip start date in ISO 8601 format (e.g. "2025-07-15T00:00:00Z")'),
        end_date: z
          .string()
          .optional()
          .describe('Trip end date in ISO 8601 format (e.g. "2025-07-22T00:00:00Z")'),
        notes: z.string().optional().describe('Planning notes, permits needed, logistics'),
        pack_id: z.string().optional().describe('Optionally link an existing pack to this trip'),
      },
    },
    async ({
      name,
      description,
      location_name,
      latitude,
      longitude,
      start_date,
      end_date,
      notes,
      pack_id,
    }) => {
      try {
        const id = `t_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
        const now = new Date().toISOString();
        const data = await agent.api.post(ApiRoute.Trips, {
          id,
          name,
          description,
          location:
            latitude !== undefined && longitude !== undefined
              ? { latitude, longitude, name: location_name }
              : null,
          startDate: start_date,
          endDate: end_date,
          notes,
          packId: pack_id,
          localCreatedAt: now,
          localUpdatedAt: now,
        });
        return ok(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── Update trip ───────────────────────────────────────────────────────────

  agent.server.registerTool(
    'update_trip',
    {
      description: "Update an existing trip's details, dates, location, or linked pack.",
      inputSchema: {
        trip_id: z.string().describe('The trip ID to update'),
        name: z.string().min(1).optional().describe('New trip name'),
        description: z.string().optional().nullable().describe('New description'),
        location_name: z.string().optional().describe('New location name'),
        latitude: z.number().min(-90).max(90).optional().describe('New latitude'),
        longitude: z.number().min(-180).max(180).optional().describe('New longitude'),
        start_date: z.string().optional().nullable().describe('New start date (ISO 8601)'),
        end_date: z.string().optional().nullable().describe('New end date (ISO 8601)'),
        notes: z.string().optional().nullable().describe('Updated notes'),
        pack_id: z
          .string()
          .optional()
          .nullable()
          .describe('New linked pack ID (or null to unlink)'),
      },
    },
    async ({
      trip_id,
      name,
      description,
      location_name,
      latitude,
      longitude,
      start_date,
      end_date,
      notes,
      pack_id,
    }) => {
      try {
        const body: Record<string, unknown> = { localUpdatedAt: new Date().toISOString() };
        if (name !== undefined) body.name = name;
        if (description !== undefined) body.description = description;
        if (start_date !== undefined) body.startDate = start_date;
        if (end_date !== undefined) body.endDate = end_date;
        if (notes !== undefined) body.notes = notes;
        if (pack_id !== undefined) body.packId = pack_id;
        if (latitude !== undefined && longitude !== undefined) {
          body.location = { latitude, longitude, name: location_name };
        } else if (location_name !== undefined) {
          body.location = { name: location_name };
        }
        const data = await agent.api.patch(`${ApiRoute.Trips}/${trip_id}`, body);
        return ok(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── Delete trip ───────────────────────────────────────────────────────────

  agent.server.registerTool(
    'delete_trip',
    {
      description: 'Delete a trip (soft-delete). The trip will no longer appear in listings.',
      inputSchema: {
        trip_id: z.string().describe('The trip ID to delete'),
      },
    },
    async ({ trip_id }) => {
      try {
        const data = await agent.api.delete(`${ApiRoute.Trips}/${trip_id}`);
        return ok(data);
      } catch (e) {
        return err(e);
      }
    },
  );
}
