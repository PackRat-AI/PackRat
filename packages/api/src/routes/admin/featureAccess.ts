import {
  createFeatureAccess,
  deleteFeatureAccess,
  listFeatureAccessForAdmin,
  updateFeatureAccess,
} from '@packrat/api/services/featureAccessService';
import { captureApiException } from '@packrat/api/utils/sentry';
import {
  AdminErrorResponses,
  AdminFeatureAccessListSchema,
  FeatureAccessCreateBodySchema,
  FeatureAccessUpdateBodySchema,
  SuccessSchema,
} from '@packrat/schemas/admin';
import { Elysia, status } from 'elysia';
import { z } from 'zod';

function toWireRow(row: {
  key: string;
  label: string;
  description: string | null;
  earlyAccessUntil: Date | null;
  releasedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    key: row.key,
    label: row.label,
    description: row.description,
    earlyAccessUntil: row.earlyAccessUntil?.toISOString() ?? null,
    releasedAt: row.releasedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const adminFeatureAccessRoutes = new Elysia({ prefix: '/feature-access' })
  .get(
    '/',
    async () => {
      try {
        const rows = await listFeatureAccessForAdmin();
        return rows.map(toWireRow);
      } catch (error) {
        captureApiException({
          error,
          operation: 'featureAccess.listAdmin.route',
          tags: { feature: 'featureAccess' },
        });
        return status(500, { error: 'Failed to list feature-access config' });
      }
    },
    {
      response: { 200: AdminFeatureAccessListSchema, ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'List all feature-access (early-access paywall) rows' },
    },
  )
  .post(
    '/',
    async ({ body }) => {
      try {
        const row = await createFeatureAccess({
          key: body.key,
          label: body.label,
          description: body.description ?? null,
          earlyAccessUntil: body.earlyAccessUntil ? new Date(body.earlyAccessUntil) : null,
        });
        return toWireRow(row);
      } catch (error) {
        if ((error as { code?: string })?.code === '23505') {
          return status(409, { error: 'A feature-access row with this key already exists' });
        }
        captureApiException({
          error,
          operation: 'featureAccess.create.route',
          tags: { feature: 'featureAccess' },
          extra: { key: body.key },
        });
        return status(500, { error: 'Failed to create feature-access row' });
      }
    },
    {
      body: FeatureAccessCreateBodySchema,
      response: { 200: AdminFeatureAccessListSchema.element, ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'Create a feature-access row' },
    },
  )
  .patch(
    '/:key',
    async ({ params, body }) => {
      try {
        const row = await updateFeatureAccess(params.key, {
          label: body.label,
          description: body.description,
          earlyAccessUntil:
            body.earlyAccessUntil === undefined
              ? undefined
              : body.earlyAccessUntil === null
                ? null
                : new Date(body.earlyAccessUntil),
        });
        if (!row) return status(404, { error: 'Feature-access row not found' });
        return toWireRow(row);
      } catch (error) {
        captureApiException({
          error,
          operation: 'featureAccess.update.route',
          tags: { feature: 'featureAccess' },
          extra: { key: params.key },
        });
        return status(500, { error: 'Failed to update feature-access row' });
      }
    },
    {
      params: z.object({ key: z.string().min(1) }),
      body: FeatureAccessUpdateBodySchema,
      response: { 200: AdminFeatureAccessListSchema.element, ...AdminErrorResponses },
      detail: {
        tags: ['Admin'],
        summary: 'Update a feature-access row (label / early-access window)',
      },
    },
  )
  .delete(
    '/:key',
    async ({ params }) => {
      try {
        const deleted = await deleteFeatureAccess(params.key);
        if (!deleted) return status(404, { error: 'Feature-access row not found' });
        return { success: true as const };
      } catch (error) {
        captureApiException({
          error,
          operation: 'featureAccess.delete.route',
          tags: { feature: 'featureAccess' },
          extra: { key: params.key },
        });
        return status(500, { error: 'Failed to delete feature-access row' });
      }
    },
    {
      params: z.object({ key: z.string().min(1) }),
      response: { 200: SuccessSchema, ...AdminErrorResponses },
      detail: {
        tags: ['Admin'],
        summary: 'Delete a feature-access row (feature becomes fully ungated)',
      },
    },
  );
