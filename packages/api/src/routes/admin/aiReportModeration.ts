import { listPendingAiReports, resolveAiReport } from '@packrat/api/services/aiReportModeration';
import {
  AdminAiReportActionSchema,
  AdminAiReportsResponseSchema,
  AdminErrorResponses,
} from '@packrat/schemas/admin';
import { Elysia, status } from 'elysia';
import { z } from 'zod';

// Reported AI chat answers. Mounted under /api/admin, so the admin auth guard
// in ./index.ts already ran.
export const adminAiReportModerationRoutes = new Elysia({ prefix: '/ai-reports' })
  .get('/', async () => ({ items: await listPendingAiReports() }), {
    response: { 200: AdminAiReportsResponseSchema, ...AdminErrorResponses },
    detail: { tags: ['Admin'], summary: 'Pending reports on AI chat answers, oldest first' },
  })
  .post(
    '/:id/:action',
    async ({ params }) => {
      const result = await resolveAiReport(params);
      return result.ok ? result.value : status(result.status, { error: result.error });
    },
    {
      params: z.object({ id: z.coerce.number().int(), action: AdminAiReportActionSchema }),
      detail: { tags: ['Admin'], summary: 'Dismiss a reported AI answer, or mark it resolved' },
    },
  );
