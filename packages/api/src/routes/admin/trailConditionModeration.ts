import {
  listPendingTrailFlags,
  resolveTrailFlags,
} from '@packrat/api/services/trailConditionModeration';
import { AdminErrorResponses } from '@packrat/schemas/admin';
import { AdminTrailFlagsResponseSchema } from '@packrat/schemas/trailConditions';
import { Elysia, status } from 'elysia';
import { z } from 'zod';

// Trail condition report moderation. Mounted under /api/admin, so the admin
// auth guard in ./index.ts already ran.
export const adminTrailConditionModerationRoutes = new Elysia({ prefix: '/trail-conditions' })
  .get('/flags', async () => ({ items: await listPendingTrailFlags() }), {
    response: { 200: AdminTrailFlagsResponseSchema, ...AdminErrorResponses },
    detail: { tags: ['Admin'], summary: 'Pending trail report flags, one row per report' },
  })
  .post(
    '/flags/:reportId/:action',
    async ({ params }) => {
      const result = await resolveTrailFlags(params);
      return result.ok ? result.value : status(result.status, { error: result.error });
    },
    {
      params: z.object({ reportId: z.string().min(1), action: z.enum(['dismiss', 'remove']) }),
      detail: {
        tags: ['Admin'],
        summary: 'Dismiss the flags on a trail report, or remove the report for everyone',
      },
    },
  );
