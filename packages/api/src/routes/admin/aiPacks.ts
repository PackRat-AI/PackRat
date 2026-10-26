import {
  createAdminPackItem,
  deleteAdminPackItem,
  getAdminPack,
  updateAdminPack,
  updateAdminPackItem,
} from '@packrat/api/services/adminPacksService';
import { PackService } from '@packrat/api/services/packService';
import { resolveAppTemplateOwnerId } from '@packrat/api/services/packTemplateImportService';
import { captureApiException } from '@packrat/api/utils/sentry';
import {
  AdminErrorResponses,
  AdminGeneratePacksBodySchema,
  AdminGeneratePacksResponseSchema,
  AdminPackDetailSchema,
  AdminPackIdParamSchema,
  AdminPackTemplateItemCreateBodySchema,
  AdminPackTemplateItemSchema,
  AdminPackTemplateItemUpdateBodySchema,
  AdminPackUpdateBodySchema,
  SuccessSchema,
} from '@packrat/schemas/admin';
import { Elysia, status } from 'elysia';

// AI-generated packs. Mounted under /api/admin, so the admin auth guard in
// ./index.ts already ran. Packs are owned by the same ADMIN account that owns
// app templates, since the console session is not a user. They land private:
// an admin reviews and edits them, then publishes by setting isPublic.
export const adminAiPacksRoutes = new Elysia({ prefix: '/packs' })
  .post(
    '/generate',
    async ({ body }) => {
      const ownerUserId = await resolveAppTemplateOwnerId();
      if (!ownerUserId) {
        return status(503, { error: 'No ADMIN user exists to own generated packs' });
      }
      try {
        const created = await new PackService(ownerUserId).generatePacks({
          count: body.count,
          isPublic: false,
        });
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
      detail: { tags: ['Admin'], summary: 'Generate draft AI packs from catalog items' },
    },
  )
  .get(
    '/:id',
    async ({ params }) => {
      const pack = await getAdminPack(params.id);
      return pack ?? status(404, { error: 'Pack not found' });
    },
    {
      params: AdminPackIdParamSchema,
      response: { 200: AdminPackDetailSchema, ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'Get a pack with its items' },
    },
  )
  .patch(
    '/:id',
    async ({ params, body }) => {
      const pack = await updateAdminPack({ id: params.id, changes: body });
      return pack ?? status(404, { error: 'AI-generated pack not found' });
    },
    {
      params: AdminPackIdParamSchema,
      body: AdminPackUpdateBodySchema,
      response: { 200: AdminPackDetailSchema, ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'Edit or publish an AI-generated pack' },
    },
  )
  .post(
    '/:id/items',
    async ({ params, body }) => {
      const item = await createAdminPackItem({ packId: params.id, item: body });
      return item ?? status(404, { error: 'AI-generated pack not found' });
    },
    {
      params: AdminPackIdParamSchema,
      body: AdminPackTemplateItemCreateBodySchema,
      response: { 200: AdminPackTemplateItemSchema, ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'Add an item to an AI-generated pack' },
    },
  )
  .patch(
    '/items/:id',
    async ({ params, body }) => {
      const item = await updateAdminPackItem({ itemId: params.id, changes: body });
      return item ?? status(404, { error: 'Item not found' });
    },
    {
      params: AdminPackIdParamSchema,
      body: AdminPackTemplateItemUpdateBodySchema,
      response: { 200: AdminPackTemplateItemSchema, ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'Edit an AI-generated pack item' },
    },
  )
  .delete(
    '/items/:id',
    async ({ params }) => {
      const ok = await deleteAdminPackItem(params.id);
      return ok ? { success: true } : status(404, { error: 'Item not found' });
    },
    {
      params: AdminPackIdParamSchema,
      response: { 200: SuccessSchema, ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'Remove an item from an AI-generated pack' },
    },
  );
