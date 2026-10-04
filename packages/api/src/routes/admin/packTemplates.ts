import {
  deleteCuratedPackTemplate,
  deleteCuratedPackTemplateItem,
  getCuratedPackTemplate,
  listCuratedPackTemplates,
  updateCuratedPackTemplate,
  updateCuratedPackTemplateItem,
} from '@packrat/api/services/adminPackTemplatesService';
import {
  classifyImportError,
  importPackTemplateFromOnlineContent,
  resolveAppTemplateOwnerId,
} from '@packrat/api/services/packTemplateImportService';
import { captureApiException } from '@packrat/api/utils/sentry';
import {
  AdminErrorResponses,
  AdminPackTemplateDetailSchema,
  AdminPackTemplateIdParamSchema,
  AdminPackTemplateImportBodySchema,
  AdminPackTemplateItemSchema,
  AdminPackTemplateItemUpdateBodySchema,
  AdminPackTemplateListSchema,
  AdminPackTemplateUpdateBodySchema,
  SuccessSchema,
} from '@packrat/schemas/admin';
import { Elysia, status } from 'elysia';

// Featured-pack curation. Mounted under /api/admin, so the admin auth guard in
// ./index.ts already ran.
export const adminPackTemplatesRoutes = new Elysia({ prefix: '/pack-templates' })
  .get('/', () => listCuratedPackTemplates(), {
    response: { 200: AdminPackTemplateListSchema, ...AdminErrorResponses },
    detail: { tags: ['Admin'], summary: 'List featured packs (published app templates + drafts)' },
  })
  .post(
    '/import',
    async ({ body }) => {
      const ownerUserId = await resolveAppTemplateOwnerId();
      if (!ownerUserId) {
        return status(503, { error: 'No ADMIN user exists to own app templates' });
      }
      try {
        // Imports land as drafts: a human reviews the AI's gear list before
        // users see it, then publishes via PATCH isAppTemplate.
        const result = await importPackTemplateFromOnlineContent({
          contentUrl: body.contentUrl,
          ownerUserId,
          isAppTemplate: false,
        });
        if (!result.ok) {
          switch (result.reason) {
            case 'invalid_url':
              return status(400, { error: 'contentUrl must be a valid URL' });
            case 'fetch_failed':
              return status(500, {
                error: `Couldn't fetch that post: ${result.message}`,
                code: 'CONTENT_FETCH_ERROR',
              });
            case 'duplicate':
              return status(409, {
                error: 'This post has already been imported.',
                code: 'DUPLICATE_TEMPLATE',
                existingTemplateId: result.existingTemplateId,
              });
          }
        }
        const detail = await getCuratedPackTemplate(result.template.id);
        if (!detail) return status(500, { error: 'Imported template could not be read back' });
        return detail;
      } catch (error) {
        const code = classifyImportError(error);
        captureApiException({
          error,
          operation: 'adminPackTemplates.import',
          extra: { contentUrl: body.contentUrl, errorCode: code },
        });
        return status(500, { error: 'Import failed', code });
      }
    },
    {
      body: AdminPackTemplateImportBodySchema,
      response: { 200: AdminPackTemplateDetailSchema, ...AdminErrorResponses },
      detail: {
        tags: ['Admin'],
        summary: 'Import a TikTok/YouTube gear list as a draft featured pack',
      },
    },
  )
  .get(
    '/:id',
    async ({ params }) => {
      const template = await getCuratedPackTemplate(params.id);
      return template ?? status(404, { error: 'Template not found' });
    },
    {
      params: AdminPackTemplateIdParamSchema,
      response: { 200: AdminPackTemplateDetailSchema, ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'Get a featured pack with its items' },
    },
  )
  .patch(
    '/:id',
    async ({ params, body }) => {
      const template = await updateCuratedPackTemplate({ id: params.id, changes: body });
      return template ?? status(404, { error: 'Template not found' });
    },
    {
      params: AdminPackTemplateIdParamSchema,
      body: AdminPackTemplateUpdateBodySchema,
      response: { 200: AdminPackTemplateDetailSchema, ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'Edit or publish/unpublish a featured pack' },
    },
  )
  .delete(
    '/:id',
    async ({ params }) => {
      const ok = await deleteCuratedPackTemplate(params.id);
      return ok ? { success: true } : status(404, { error: 'Template not found' });
    },
    {
      params: AdminPackTemplateIdParamSchema,
      response: { 200: SuccessSchema, ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'Soft-delete a featured pack' },
    },
  )
  .patch(
    '/items/:id',
    async ({ params, body }) => {
      const item = await updateCuratedPackTemplateItem({ itemId: params.id, changes: body });
      return item ?? status(404, { error: 'Item not found' });
    },
    {
      params: AdminPackTemplateIdParamSchema,
      body: AdminPackTemplateItemUpdateBodySchema,
      response: { 200: AdminPackTemplateItemSchema, ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'Edit a featured pack item' },
    },
  )
  .delete(
    '/items/:id',
    async ({ params }) => {
      const ok = await deleteCuratedPackTemplateItem(params.id);
      return ok ? { success: true } : status(404, { error: 'Item not found' });
    },
    {
      params: AdminPackTemplateIdParamSchema,
      response: { 200: SuccessSchema, ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'Remove an item from a featured pack' },
    },
  );
