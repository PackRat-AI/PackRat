import { createDb } from '@packrat/api/db';
import { authPlugin } from '@packrat/api/middleware/auth';
import { tripGoals, tripStatsSettings } from '@packrat/db/schema';
import {
  CreateTripGoalBodySchema,
  TripGoalSchema,
  TripStatsSettingsSchema,
  UpdateTripGoalBodySchema,
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
  );
