import {
  listPendingReports,
  resolveReports,
  setUserSuspended,
} from '@packrat/api/services/feedService';
import { AdminErrorResponses } from '@packrat/schemas/admin';
import {
  AdminFeedReportsResponseSchema,
  AdminReportTargetParamsSchema,
} from '@packrat/schemas/feed';
import { Elysia, status } from 'elysia';
import { z } from 'zod';

// Community feed moderation. Mounted under /api/admin, so the admin auth guard
// in ./index.ts already ran.
export const adminFeedModerationRoutes = new Elysia({ prefix: '/feed' })
  .get('/reports', async () => ({ items: await listPendingReports() }), {
    response: { 200: AdminFeedReportsResponseSchema, ...AdminErrorResponses },
    detail: { tags: ['Admin'], summary: 'Pending feed reports, one row per reported item' },
  })
  .post(
    '/reports/:targetType/:targetId/:action',
    async ({ params }) => {
      const result = await resolveReports(params);
      return result.ok ? result.value : status(result.status, { error: result.error });
    },
    {
      params: AdminReportTargetParamsSchema.extend({ action: z.enum(['dismiss', 'remove']) }),
      detail: {
        tags: ['Admin'],
        summary: 'Dismiss the reports on an item, or remove the item for everyone',
      },
    },
  )
  .put(
    '/users/:userId/suspension',
    async ({ params, body }) => {
      const result = await setUserSuspended({ userId: params.userId, suspended: body.suspended });
      return result.ok ? result.value : status(result.status, { error: result.error });
    },
    {
      params: z.object({ userId: z.string().min(1) }),
      body: z.object({ suspended: z.boolean() }),
      detail: { tags: ['Admin'], summary: 'Suspend or reinstate an account from the feed' },
    },
  );
