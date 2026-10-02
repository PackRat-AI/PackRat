import {
  deleteFeatureFlagOverride,
  listFeatureFlagsForAdmin,
  setFeatureFlagPlatformOverride,
  upsertFeatureFlagOverride,
} from '@packrat/api/services/featureFlagsService';
import { captureApiException } from '@packrat/api/utils/sentry';
import {
  AdminErrorResponses,
  AdminFeatureFlagListSchema,
  FeatureFlagKeyParamSchema,
  FeatureFlagPlatformOverrideBodySchema,
  FeatureFlagPlatformParamSchema,
  FeatureFlagUpsertBodySchema,
  SuccessSchema,
} from '@packrat/schemas/admin';
import { Elysia, status } from 'elysia';

export const adminFeatureFlagsRoutes = new Elysia({ prefix: '/feature-flags' })
  .get(
    '/',
    async () => {
      try {
        const items = await listFeatureFlagsForAdmin();
        return items.map((item) => ({
          ...item,
          updatedAt: item.updatedAt?.toISOString() ?? null,
          // The nested timestamps need serialising too — the spread above
          // copies Date objects straight through, which the response schema
          // (rightly) rejects.
          platformOverrides: Object.fromEntries(
            Object.entries(item.platformOverrides).map(([platform, override]) => [
              platform,
              override && { ...override, updatedAt: override.updatedAt.toISOString() },
            ]),
          ),
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
      params: FeatureFlagKeyParamSchema,
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
      params: FeatureFlagKeyParamSchema,
      response: { 200: SuccessSchema, ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'Reset a feature flag to its coded default' },
    },
  )
  // One route sets and clears: `enabled: null` means "inherit the global
  // value", which is stored as the absence of a row. A separate DELETE would
  // be a second way to say the same thing.
  .put(
    '/:key/platforms/:platform',
    async ({ params, body }) => {
      try {
        await setFeatureFlagPlatformOverride({
          key: params.key,
          platform: params.platform,
          enabled: body.enabled,
          reason: body.reason,
        });
        return { success: true as const };
      } catch (error) {
        captureApiException({
          error,
          operation: 'featureFlags.setPlatformOverride.route',
          tags: { feature: 'featureFlags' },
          extra: { key: params.key, platform: params.platform, enabled: body.enabled },
        });
        return status(500, { error: 'Failed to update platform override' });
      }
    },
    {
      params: FeatureFlagPlatformParamSchema,
      body: FeatureFlagPlatformOverrideBodySchema,
      response: { 200: SuccessSchema, ...AdminErrorResponses },
      detail: {
        tags: ['Admin'],
        summary: 'Set or clear a per-platform override for a feature flag',
      },
    },
  );
