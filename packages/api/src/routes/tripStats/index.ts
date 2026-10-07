import { createDb } from '@packrat/api/db';
import { authPlugin } from '@packrat/api/middleware/auth';
import { findNearbyPeaks } from '@packrat/api/services/peaksService';
import { captureApiException } from '@packrat/api/utils/sentry';
import { tripGoals, tripStatsEntries, tripStatsSettings } from '@packrat/db/schema';
import {
  CreateTripGoalBodySchema,
  CreateTripStatsEntryBodySchema,
  NearbyPeakSchema,
  NearbyPeaksQuerySchema,
  TripGoalSchema,
  TripStatsEntrySchema,
  TripStatsSettingsSchema,
  UpdateTripGoalBodySchema,
  UpdateTripStatsEntryBodySchema,
} from '@packrat/schemas/tripStats';
import { and, eq } from 'drizzle-orm';
import { Elysia, NotFoundError, status } from 'elysia';
import { z } from 'zod';

/**
 * Goals and settings behind trip stats. Progress is never stored here: the
 * client works it out from the user's trips, so a goal is only its definition.
 * See `docs/features/trip-stats.md`.
 */
export const tripStatsRoutes = new Elysia({ prefix: '/trip-stats' })
  .model({
    'tripStats.CreateGoalBody': CreateTripGoalBodySchema,
    'tripStats.Goal': TripGoalSchema,
    'tripStats.Settings': TripStatsSettingsSchema,
    'tripStats.UpdateGoalBody': UpdateTripGoalBodySchema,
    'tripStats.Entry': TripStatsEntrySchema,
    'tripStats.CreateEntryBody': CreateTripStatsEntryBodySchema,
    'tripStats.UpdateEntryBody': UpdateTripStatsEntryBodySchema,
  })
  .use(authPlugin)

  // Settings — a user with no row hasn't answered the opt-in and gave no break reason.
  .get(
    '/settings',
    async ({ user }) => {
      const db = createDb();
      const [row] = await db
        .tag('tripStats.getSettings')
        .select({
          enabled: tripStatsSettings.enabled,
          breakReason: tripStatsSettings.breakReason,
          breakReasonTripId: tripStatsSettings.breakReasonTripId,
        })
        .from(tripStatsSettings)
        .where(eq(tripStatsSettings.userId, user.userId))
        .limit(1);
      return TripStatsSettingsSchema.parse(
        row ?? { enabled: null, breakReason: null, breakReasonTripId: null },
      );
    },
    {
      response: { 200: 'tripStats.Settings' },
      isAuthenticated: true,
      detail: {
        tags: ['Trip Stats'],
        summary: 'Get trip stats settings',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Full replace — the client always sends complete settings.
  .put(
    '/settings',
    async ({ body, user }) => {
      const db = createDb();
      const values = {
        enabled: body.enabled,
        breakReason: body.breakReason ?? null,
        breakReasonTripId: body.breakReasonTripId ?? null,
        updatedAt: new Date(),
      };
      const [row] = await db
        .tag('tripStats.putSettings')
        .insert(tripStatsSettings)
        .values({ userId: user.userId, ...values })
        .onConflictDoUpdate({ target: tripStatsSettings.userId, set: values })
        .returning();
      return TripStatsSettingsSchema.parse(row);
    },
    {
      body: 'tripStats.Settings',
      response: { 200: 'tripStats.Settings' },
      isAuthenticated: true,
      detail: {
        tags: ['Trip Stats'],
        summary: 'Replace trip stats settings',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // List goals
  .get(
    '/goals',
    async ({ user }) => {
      const db = createDb();
      const goals = await db.tag('tripStats.listGoals').query.tripGoals.findMany({
        where: and(eq(tripGoals.userId, user.userId), eq(tripGoals.deleted, false)),
        orderBy: (t) => t.createdAt,
      });
      return z.array(TripGoalSchema).parse(goals);
    },
    {
      response: { 200: z.array(TripGoalSchema) },
      isAuthenticated: true,
      detail: {
        tags: ['Trip Stats'],
        summary: 'List trip stats goals',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Create goal. The id is client-generated so an offline create keeps its
  // identity when the outbox replays it.
  .post(
    '/goals',
    async ({ body, user }) => {
      const db = createDb();
      const [goal] = await db
        .tag('tripStats.createGoal')
        .insert(tripGoals)
        .values({
          id: body.id,
          userId: user.userId,
          kind: body.kind,
          metric: body.metric,
          target: body.target,
          year: body.kind === 'annual' ? (body.year ?? null) : null,
          name: body.name ?? null,
          startDate: body.kind === 'custom' && body.startDate ? new Date(body.startDate) : null,
          endDate: body.kind === 'custom' && body.endDate ? new Date(body.endDate) : null,
          localCreatedAt: new Date(body.localCreatedAt),
          localUpdatedAt: new Date(body.localUpdatedAt),
        })
        .onConflictDoNothing({ target: tripGoals.id })
        .returning();
      if (!goal) return status(409, { error: 'Goal already exists' });
      return TripGoalSchema.parse(goal);
    },
    {
      body: 'tripStats.CreateGoalBody',
      response: { 200: 'tripStats.Goal', 409: z.object({ error: z.string() }) },
      isAuthenticated: true,
      detail: {
        tags: ['Trip Stats'],
        summary: 'Create a trip stats goal',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Replace goal
  .put(
    '/goals/:goalId',
    async ({ params, body, user }) => {
      const db = createDb();
      const [goal] = await db
        .tag('tripStats.updateGoal')
        .update(tripGoals)
        .set({
          kind: body.kind,
          metric: body.metric,
          target: body.target,
          year: body.kind === 'annual' ? (body.year ?? null) : null,
          name: body.name ?? null,
          startDate: body.kind === 'custom' && body.startDate ? new Date(body.startDate) : null,
          endDate: body.kind === 'custom' && body.endDate ? new Date(body.endDate) : null,
          localUpdatedAt: body.localUpdatedAt ? new Date(body.localUpdatedAt) : new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(tripGoals.id, params.goalId),
            eq(tripGoals.userId, user.userId),
            eq(tripGoals.deleted, false),
          ),
        )
        .returning();
      if (!goal) throw new NotFoundError('Goal not found');
      return TripGoalSchema.parse(goal);
    },
    {
      params: z.object({ goalId: z.string() }),
      body: 'tripStats.UpdateGoalBody',
      response: { 200: 'tripStats.Goal' },
      isAuthenticated: true,
      detail: {
        tags: ['Trip Stats'],
        summary: 'Replace a trip stats goal',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Delete goal (soft)
  .delete(
    '/goals/:goalId',
    async ({ params, user }) => {
      const db = createDb();
      const [deleted] = await db
        .tag('tripStats.deleteGoal')
        .update(tripGoals)
        .set({ deleted: true, updatedAt: new Date() })
        .where(and(eq(tripGoals.id, params.goalId), eq(tripGoals.userId, user.userId)))
        .returning();
      if (!deleted) return status(404, { error: 'Goal not found' });
      return { success: true };
    },
    {
      params: z.object({ goalId: z.string() }),
      isAuthenticated: true,
      detail: {
        tags: ['Trip Stats'],
        summary: 'Delete a trip stats goal',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Park visits and summits added by hand, for outings from before PackRat.
  .get(
    '/entries',
    async ({ user }) => {
      const db = createDb();
      const entries = await db.tag('tripStats.listEntries').query.tripStatsEntries.findMany({
        where: and(eq(tripStatsEntries.userId, user.userId), eq(tripStatsEntries.deleted, false)),
        orderBy: (t) => t.createdAt,
      });
      return z.array(TripStatsEntrySchema).parse(entries);
    },
    {
      response: { 200: z.array(TripStatsEntrySchema) },
      isAuthenticated: true,
      detail: {
        tags: ['Trip Stats'],
        summary: 'List park visits and summits added by hand',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Client-generated id, as for goals.
  .post(
    '/entries',
    async ({ body, user }) => {
      const db = createDb();
      const [entry] = await db
        .tag('tripStats.createEntry')
        .insert(tripStatsEntries)
        .values({
          id: body.id,
          userId: user.userId,
          ...entryValues(body),
          localCreatedAt: new Date(body.localCreatedAt),
          localUpdatedAt: new Date(body.localUpdatedAt),
        })
        .onConflictDoNothing({ target: tripStatsEntries.id })
        .returning();
      if (!entry) return status(409, { error: 'Entry already exists' });
      return TripStatsEntrySchema.parse(entry);
    },
    {
      body: 'tripStats.CreateEntryBody',
      response: { 200: 'tripStats.Entry', 409: z.object({ error: z.string() }) },
      isAuthenticated: true,
      detail: {
        tags: ['Trip Stats'],
        summary: 'Add a park visit or summit by hand',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  .put(
    '/entries/:entryId',
    async ({ params, body, user }) => {
      const db = createDb();
      const [entry] = await db
        .tag('tripStats.updateEntry')
        .update(tripStatsEntries)
        .set({
          ...entryValues(body),
          localUpdatedAt: body.localUpdatedAt ? new Date(body.localUpdatedAt) : new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(tripStatsEntries.id, params.entryId),
            eq(tripStatsEntries.userId, user.userId),
            eq(tripStatsEntries.deleted, false),
          ),
        )
        .returning();
      if (!entry) throw new NotFoundError('Entry not found');
      return TripStatsEntrySchema.parse(entry);
    },
    {
      params: z.object({ entryId: z.string() }),
      body: 'tripStats.UpdateEntryBody',
      response: { 200: 'tripStats.Entry' },
      isAuthenticated: true,
      detail: {
        tags: ['Trip Stats'],
        summary: 'Replace a park visit or summit added by hand',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  .delete(
    '/entries/:entryId',
    async ({ params, user }) => {
      const db = createDb();
      const [deleted] = await db
        .tag('tripStats.deleteEntry')
        .update(tripStatsEntries)
        .set({ deleted: true, updatedAt: new Date() })
        .where(
          and(eq(tripStatsEntries.id, params.entryId), eq(tripStatsEntries.userId, user.userId)),
        )
        .returning();
      if (!deleted) return status(404, { error: 'Entry not found' });
      return { success: true };
    },
    {
      params: z.object({ entryId: z.string() }),
      isAuthenticated: true,
      detail: {
        tags: ['Trip Stats'],
        summary: 'Delete a park visit or summit added by hand',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Named peaks in a bounding box, for picking a trip's summits.
  .get(
    '/peaks/nearby',
    async ({ query }) => {
      try {
        return await findNearbyPeaks(query);
      } catch (error) {
        captureApiException({ error, operation: 'tripStats.nearbyPeaks', extra: { ...query } });
        return status(502, { error: 'Peak lookup is unavailable right now' });
      }
    },
    {
      query: NearbyPeaksQuerySchema,
      response: { 200: z.array(NearbyPeakSchema), 502: z.object({ error: z.string() }) },
      isAuthenticated: true,
      detail: {
        tags: ['Trip Stats'],
        summary: 'Named peaks inside a bounding box, from OpenStreetMap',
        security: [{ bearerAuth: [] }],
      },
    },
  );

/** Only the fields that belong to an entry's kind are kept. */
function entryValues(body: {
  kind: 'park' | 'summit';
  parkCode?: string | null;
  name?: string | null;
  elevationMeters?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  osmId?: number | null;
  date?: string | null;
}) {
  const isSummit = body.kind === 'summit';
  return {
    kind: body.kind,
    parkCode: isSummit ? null : (body.parkCode ?? null),
    name: isSummit ? (body.name?.trim() ?? null) : null,
    elevationMeters: isSummit ? (body.elevationMeters ?? null) : null,
    latitude: isSummit ? (body.latitude ?? null) : null,
    longitude: isSummit ? (body.longitude ?? null) : null,
    osmId: isSummit ? (body.osmId ?? null) : null,
    date: body.date ? new Date(body.date) : null,
  };
}
