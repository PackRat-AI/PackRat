import {
  deleteFeatureFlagOverride,
  KNOWN_FEATURE_FLAG_KEYS,
  listFeatureFlagsForAdmin,
  upsertFeatureFlagOverride,
} from '@packrat/api/services/featureFlagsService';
import { captureApiException } from '@packrat/api/utils/sentry';
import {
  AdminErrorResponses,
  AdminFeatureFlagListSchema,
  FeatureFlagUpsertBodySchema,
  SuccessSchema,
} from '@packrat/schemas/admin';
import { Elysia, status } from 'elysia';
import { z } from 'zod';

// Only known keys are writable — prevents a typo from creating an orphaned
// override row that listEffectiveFeatureFlags silently ignores.
const KeyParamSchema = z.object({
  key: z.enum(KNOWN_FEATURE_FLAG_KEYS as [string, ...string[]]),
});

export const adminFeatureFlagsRoutes = new Elysia({ prefix: '/feature-flags' })
  .get(
    '/',
    async () => {
      try {
        const items = await listFeatureFlagsForAdmin();
        return items.map((item) => ({
          ...item,
          updatedAt: item.updatedAt?.toISOString() ?? null,
        }));
      } catch (error) {
        captureApiException({
          error,
          operation: 'featureFlags.listAdmin.route',
          tags: { feature: 'featureFlags' },
        });
        return status(500, { error: 'Failed to list feature flags' });
      }
    },
    {
      response: { 200: AdminFeatureFlagListSchema, ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'List all feature flags with their effective value' },
    },
  )
  .put(
    '/:key',
    async ({ params, body }) => {
      try {
        const item = await upsertFeatureFlagOverride({ key: params.key, ...body });
        return { ...item, updatedAt: item.updatedAt?.toISOString() ?? null };
      } catch (error) {
        captureApiException({
          error,
          operation: 'featureFlags.upsert.route',
          tags: { feature: 'featureFlags' },
          extra: { key: params.key },
        });
        return status(500, { error: 'Failed to update feature flag' });
      }
    },
    {
      params: KeyParamSchema,
      body: FeatureFlagUpsertBodySchema,
      response: {
        200: AdminFeatureFlagListSchema.element,
        ...AdminErrorResponses,
      },
      detail: { tags: ['Admin'], summary: 'Set an override for a feature flag' },
    },
  )
  .delete(
    '/:key',
    async ({ params }) => {
      try {
        const deleted = await deleteFeatureFlagOverride(params.key);
        if (!deleted) return status(404, { error: 'No override set for this key' });
        return { success: true as const };
      } catch (error) {
        captureApiException({
          error,
          operation: 'featureFlags.delete.route',
          tags: { feature: 'featureFlags' },
          extra: { key: params.key },
        });
        return status(500, { error: 'Failed to reset feature flag' });
      }
    },
    {
      params: KeyParamSchema,
      response: { 200: SuccessSchema, ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'Reset a feature flag to its coded default' },
    },
  );
