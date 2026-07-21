import { hasProEntitlement } from '@packrat/api/services';
import { describe, expect, it } from 'vitest';
import { app } from '../src/index';

const WEBHOOK_SECRET = 'test-revenuecat-webhook-secret';
const HOUR = 60 * 60 * 1000;

async function postWebhook(
  event: Record<string, unknown>,
  auth: string | undefined = WEBHOOK_SECRET,
) {
  const resp = await app.fetch(
    new Request('http://localhost/api/webhooks/revenuecat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(auth !== undefined ? { authorization: auth } : {}),
      },
      body: JSON.stringify({ event }),
    }),
  );
  return { status: resp.status, body: (await resp.json()) as Record<string, unknown> };
}

describe('RevenueCat webhook (end to end: route → Postgres → hasProEntitlement)', () => {
  it('rejects a request with no Authorization header', async () => {
    const { status } = await postWebhook({ type: 'INITIAL_PURCHASE' }, undefined);
    expect(status).toBe(401);
  });

  it('rejects a request with a wrong secret', async () => {
    const { status } = await postWebhook({ type: 'INITIAL_PURCHASE' }, 'wrong-secret');
    expect(status).toBe(401);
  });

  it('rejects a malformed event body', async () => {
    const { status } = await postWebhook({ notType: 'x' });
    expect(status).toBe(400);
  });

  it('grants Pro on INITIAL_PURCHASE and revokes on EXPIRATION', async () => {
    const appUserId = `user_${Date.now()}`;

    const purchase = await postWebhook({
      type: 'INITIAL_PURCHASE',
      id: 'evt_purchase',
      app_user_id: appUserId,
      entitlement_ids: ['PackRat Pro'],
      expiration_at_ms: Date.now() + 30 * 24 * HOUR,
      store: 'APP_STORE',
      product_id: 'yearly',
    });
    expect(purchase.status).toBe(200);
    expect(purchase.body).toMatchObject({ ok: true, written: 1 });
    expect(await hasProEntitlement(appUserId)).toBe(true);

    // Re-delivering the same event is idempotent — still exactly one active row.
    await postWebhook({
      type: 'INITIAL_PURCHASE',
      id: 'evt_purchase',
      app_user_id: appUserId,
      entitlement_ids: ['PackRat Pro'],
      expiration_at_ms: Date.now() + 30 * 24 * HOUR,
    });
    expect(await hasProEntitlement(appUserId)).toBe(true);

    const expire = await postWebhook({
      type: 'EXPIRATION',
      id: 'evt_expire',
      app_user_id: appUserId,
      entitlement_ids: ['PackRat Pro'],
      expiration_at_ms: Date.now() - HOUR,
    });
    expect(expire.status).toBe(200);
    expect(await hasProEntitlement(appUserId)).toBe(false);
  });

  it('does not grant Pro when the active entitlement has already expired', async () => {
    const appUserId = `user_expired_${Date.now()}`;
    // A renewal marked active but with a past expiry should not count as Pro.
    await postWebhook({
      type: 'RENEWAL',
      app_user_id: appUserId,
      entitlement_ids: ['PackRat Pro'],
      expiration_at_ms: Date.now() - HOUR,
    });
    // isActive is true, but the query also requires an unexpired window, so the
    // stale row must not count as Pro.
    expect(await hasProEntitlement(appUserId)).toBe(false);
  });
});
