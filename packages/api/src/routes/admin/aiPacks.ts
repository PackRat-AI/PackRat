import { PackService } from '@packrat/api/services/packService';
import { resolveAppTemplateOwnerId } from '@packrat/api/services/packTemplateImportService';
import { captureApiException } from '@packrat/api/utils/sentry';
import {
  AdminErrorResponses,
  AdminGeneratePacksBodySchema,
  AdminGeneratePacksResponseSchema,
} from '@packrat/schemas/admin';
import { Elysia, status } from 'elysia';

// AI-generated public packs. Mounted under /api/admin, so the admin auth guard
// in ./index.ts already ran. Packs are owned by the same ADMIN account that
// owns app templates, since the console session is not a user.
export const adminAiPacksRoutes = new Elysia({ prefix: '/packs' }).post(
  '/generate',
  async ({ body }) => {
    const ownerUserId = await resolveAppTemplateOwnerId();
    if (!ownerUserId) {
      return status(503, { error: 'No ADMIN user exists to own generated packs' });
    }
    try {
      const created = await new PackService(ownerUserId).generatePacks(body.count);
      return {
        items: created.map((pack) => ({
          id: pack.id,
          name: pack.name,
          description: pack.description,
          category: pack.category,
          tags: pack.tags ?? [],
        })),
      };
    } catch (error) {
      captureApiException({
        error,
        operation: 'adminAiPacks.generate',
        extra: { count: body.count, httpStatus: 500, errorCode: 'AI_PACKS_GENERATE_ERROR' },
      });
      return status(500, { error: 'Pack generation failed', code: 'AI_PACKS_GENERATE_ERROR' });
    }
  },
  {
    body: AdminGeneratePacksBodySchema,
    response: { 200: AdminGeneratePacksResponseSchema, ...AdminErrorResponses },
    detail: { tags: ['Admin'], summary: 'Generate public AI packs from catalog items' },
  },
);
