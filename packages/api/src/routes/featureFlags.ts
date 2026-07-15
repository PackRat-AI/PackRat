import { captureApiException } from '@packrat/api/utils/sentry';
import { Elysia, status } from 'elysia';
import { listEffectiveFeatureFlags } from '../services/featureFlagsService';

/**
 * Feature flags — the dynamic replacement for the old build-time
 * `featureFlags` config.
 *
 * Public and unauthenticated: flag values are non-sensitive, and the client
 * needs them regardless of auth state. Returns the effective value for every
 * known key (a DB override if one exists, else the coded default in
 * @packrat/config), so a stale/unset key on the client always falls back to
 * the same value it would have shipped with today.
 */
export const featureFlagsRoutes = new Elysia({ prefix: '/feature-flags' }).get(
  '/',
  async () => {
    try {
      return await listEffectiveFeatureFlags();
    } catch (error) {
      captureApiException({
        error,
        operation: 'featureFlags.list.route',
        tags: { feature: 'featureFlags' },
      });
      return status(500, { error: 'Internal server error', code: 'FEATURE_FLAGS_LIST_ERROR' });
    }
  },
  {
    detail: {
      tags: ['Feature Flags'],
      summary: 'List effective feature flags',
      description:
        'Returns the effective boolean value for every known feature flag key. A DB override wins over the coded default.',
    },
  },
);
