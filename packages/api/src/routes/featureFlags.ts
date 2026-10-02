import { captureApiException } from '@packrat/api/utils/sentry';
import { Elysia, status, t } from 'elysia';
import { listEffectiveFeatureFlags } from '../services/featureFlagsService';

/**
 * Feature flags — the dynamic replacement for the old build-time
 * `featureFlags` config.
 *
 * Public and unauthenticated: flag values are non-sensitive, and the client
 * needs them regardless of auth state. Returns the effective value for every
 * known key, resolved in three layers — a platform override, then the global
 * override, then the coded default in @packrat/config — so a stale or unset
 * key on the client always falls back to the value it shipped with.
 *
 * `?platform=ios|android|macos` targets the caller's surface. Omitting it, or
 * sending something unrecognised, returns globally-resolved flags rather than
 * an error: an old client must not have every flag dark-launched because the
 * server did not recognise it.
 */
export const featureFlagsRoutes = new Elysia({ prefix: '/feature-flags' })
  // public-route: non-sensitive flag values the client needs regardless of auth
  // state; every key falls back to its coded default.
  .get(
    '/',
    async ({ query }) => {
      try {
        return await listEffectiveFeatureFlags(query.platform);
      } catch (error) {
        captureApiException({
          error,
          operation: 'featureFlags.list.route',
          tags: { feature: 'featureFlags' },
          extra: { platform: query.platform },
        });
        return status(500, { error: 'Internal server error', code: 'FEATURE_FLAGS_LIST_ERROR' });
      }
    },
    {
      // Deliberately a loose string rather than an enum: an unrecognised
      // platform is resolved globally, not rejected. Validating here would
      // turn a new or unknown client into a 422 and leave it with no flags.
      query: t.Object({ platform: t.Optional(t.String()) }),
      detail: {
        tags: ['Feature Flags'],
        summary: 'List effective feature flags',
        description:
          'Returns the effective boolean value for every known feature flag key, resolved for the given platform. A platform override wins over the global override, which wins over the coded default. Unrecognised platforms resolve globally.',
      },
    },
  );
