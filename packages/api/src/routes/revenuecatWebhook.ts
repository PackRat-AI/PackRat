import { getEnv } from '@packrat/api/utils/env-validation';
import { apiAddBreadcrumb, captureApiException } from '@packrat/api/utils/sentry';
import { Elysia, status, t } from 'elysia';
import { applyRevenueCatEvent, parseRevenueCatEvent } from '../services/entitlementsService';

/**
 * RevenueCat webhook receiver — the server's ingress for entitlement state.
 *
 * RevenueCat POSTs an event on every purchase/renewal/expiry/etc. We verify the
 * shared secret it sends in the Authorization header (configured on the webhook
 * in the RevenueCat dashboard, stored here as REVENUECAT_WEBHOOK_AUTH), then
 * upsert the affected entitlement rows so the API can resolve `hasPro` from its
 * own database rather than trusting the device.
 *
 * Returns 200 quickly on success so RevenueCat doesn't retry; 401 on a bad or
 * missing secret; 500 on a processing error (RevenueCat will retry, which is
 * safe because the upsert is idempotent).
 */
export const revenuecatWebhookRoutes = new Elysia({ prefix: '/webhooks/revenuecat' }).post(
  // public-route: called by RevenueCat's servers, not a logged-in user; there is
  // no session to authenticate. Authenticated instead by the shared secret in
  // the Authorization header (REVENUECAT_WEBHOOK_AUTH), checked in the handler.
  '/',
  async ({ body, headers }) => {
    const { REVENUECAT_WEBHOOK_AUTH } = getEnv();

    // Reject if we have no configured secret or it doesn't match. Constant
    // work either way; the header is a shared secret, not a signature.
    const provided = headers.authorization;
    if (!REVENUECAT_WEBHOOK_AUTH || provided !== REVENUECAT_WEBHOOK_AUTH) {
      return status(401, { error: 'Unauthorized', code: 'REVENUECAT_WEBHOOK_UNAUTHORIZED' });
    }

    const event = parseRevenueCatEvent(body.event);
    if (!event) {
      return status(400, { error: 'Malformed event', code: 'REVENUECAT_WEBHOOK_BAD_EVENT' });
    }

    apiAddBreadcrumb({
      category: 'entitlements',
      message: 'RevenueCat webhook received',
      level: 'info',
      data: { type: event.type, appUserId: event.app_user_id },
    });

    try {
      const written = await applyRevenueCatEvent(event);
      return { ok: true, written };
    } catch (error) {
      captureApiException({
        error,
        operation: 'revenuecatWebhook.post',
        tags: { feature: 'entitlements' },
        extra: { eventType: event.type },
      });
      return status(500, {
        error: 'Internal server error',
        code: 'REVENUECAT_WEBHOOK_ERROR',
      });
    }
  },
  {
    // RevenueCat's payload is large and evolving; validate only the envelope we
    // read and accept the rest so new fields don't 422 a valid webhook.
    body: t.Object({ event: t.Record(t.String(), t.Unknown()) }, { additionalProperties: true }),
    detail: {
      tags: ['Webhooks'],
      summary: 'RevenueCat webhook',
      description:
        'Receives RevenueCat subscriber events and upserts the entitlements table. Authenticated by a shared secret in the Authorization header.',
    },
  },
);
