import { captureApiException } from '@packrat/api/utils/sentry';
import { Elysia, status } from 'elysia';
import { listFeatureAccess } from '../services/featureAccessService';

/**
 * Feature-access config — the early-access monetization layer.
 *
 * Public and unauthenticated: the config (which features are in an early-access
 * window, and until when) is non-sensitive, and the client needs it to render
 * gates regardless of auth state. The actual gating decision is resolved on the
 * client by combining this config with the viewer's RevenueCat entitlement via
 * `hasFeatureAccess` from @packrat/config.
 */
export const featureAccessRoutes = new Elysia({ prefix: '/feature-access' })
  // public-route: non-sensitive early-access config the client fetches before
  // auth to render gates; the gating decision happens client-side.
  .get(
    '/',
    async () => {
      try {
        return await listFeatureAccess();
      } catch (error) {
        captureApiException({
          error,
          operation: 'featureAccess.list.route',
          tags: { feature: 'featureAccess' },
        });
        return status(500, { error: 'Internal server error', code: 'FEATURE_ACCESS_LIST_ERROR' });
      }
    },
    {
      detail: {
        tags: ['Feature Access'],
        summary: 'List feature-access config',
        description:
          'Returns the early-access config for all features. The client gates each feature by resolving its `earlyAccessUntil` against the viewer’s Pro entitlement.',
      },
    },
  );
