import { createDb } from '@packrat/api/db';
import { authPlugin } from '@packrat/api/middleware/auth';
import {
  getTrailConditionNotificationsEnabled,
  listUnreadTripIds,
  markReportsRead,
  setTrailConditionNotificationsEnabled,
} from '@packrat/api/services/trailConditionAlerts';
import { trailConditionReports } from '@packrat/db/schema';
import { TrailConditionNotificationSettingsSchema } from '@packrat/schemas/trailConditions';
import { and, eq, inArray } from 'drizzle-orm';
import { Elysia } from 'elysia';
import { z } from 'zod';
import { trailDbOrNull } from './trailDb';

export const trailConditionAlertRoutes = new Elysia()
  .use(authPlugin)
  .get(
    '/unread-trips',
    async ({ user }) => {
      const tripIds = await listUnreadTripIds({
        db: createDb(),
        trailDb: trailDbOrNull(),
        userId: user.userId,
        now: new Date(),
      });
      return { tripIds };
    },
    {
      isAuthenticated: true,
      detail: {
        tags: ['Trail Conditions'],
        summary: 'Upcoming and in-progress trips with an unread trail report',
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .post(
    '/reads',
    async ({ body, user }) => {
      const db = createDb();
      // Only reports that exist; a stale id from an old cache is skipped, not a 500.
      const existing = await db
        .tag('trailConditionAlerts.existingReports')
        .select({ id: trailConditionReports.id })
        .from(trailConditionReports)
        .where(
          and(
            inArray(trailConditionReports.id, body.reportIds),
            eq(trailConditionReports.deleted, false),
          ),
        );
      await markReportsRead({ db, userId: user.userId, reportIds: existing.map((r) => r.id) });
      return { success: true };
    },
    {
      body: z.object({ reportIds: z.array(z.string()).min(1).max(100) }),
      isAuthenticated: true,
      detail: {
        tags: ['Trail Conditions'],
        summary: 'Mark trail reports as read',
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .get(
    '/notification-settings',
    async ({ user }) => ({
      trailConditions: await getTrailConditionNotificationsEnabled({
        db: createDb(),
        userId: user.userId,
      }),
    }),
    {
      response: TrailConditionNotificationSettingsSchema,
      isAuthenticated: true,
      detail: {
        tags: ['Trail Conditions'],
        summary: 'Whether trail-condition notifications are on',
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .put(
    '/notification-settings',
    async ({ body, user }) => {
      await setTrailConditionNotificationsEnabled({
        db: createDb(),
        userId: user.userId,
        enabled: body.trailConditions,
      });
      return body;
    },
    {
      body: TrailConditionNotificationSettingsSchema,
      response: TrailConditionNotificationSettingsSchema,
      isAuthenticated: true,
      detail: {
        tags: ['Trail Conditions'],
        summary: 'Turn trail-condition notifications on or off',
        security: [{ bearerAuth: [] }],
      },
    },
  );
