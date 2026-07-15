import { describe, expect, it } from 'vitest';
import { parseRevenueCatEvent, type RevenueCatEvent, resolveActive } from '../entitlementsService';

const NOW = new Date('2026-07-15T00:00:00.000Z');
const FUTURE_MS = new Date('2026-08-15T00:00:00.000Z').getTime();
const PAST_MS = new Date('2026-06-15T00:00:00.000Z').getTime();

function event(overrides: Partial<RevenueCatEvent> & { type: string }): RevenueCatEvent {
  return { entitlement_ids: ['PackRat Pro'], ...overrides };
}

describe('resolveActive', () => {
  it('grants on purchase, renewal, product change, uncancellation, extension', () => {
    for (const type of [
      'INITIAL_PURCHASE',
      'RENEWAL',
      'PRODUCT_CHANGE',
      'UNCANCELLATION',
      'NON_RENEWING_PURCHASE',
      'SUBSCRIPTION_EXTENDED',
      'REFUND_REVERSED',
    ]) {
      expect(resolveActive(event({ type, expiration_at_ms: FUTURE_MS }), NOW)).toBe(true);
    }
  });

  it('revokes immediately on expiration and refund regardless of expiry', () => {
    expect(resolveActive(event({ type: 'EXPIRATION', expiration_at_ms: FUTURE_MS }), NOW)).toBe(
      false,
    );
    expect(resolveActive(event({ type: 'REFUND', expiration_at_ms: FUTURE_MS }), NOW)).toBe(false);
  });

  it('keeps a cancellation active until the paid period actually ends', () => {
    // Auto-renew off but still inside the paid window → active.
    expect(resolveActive(event({ type: 'CANCELLATION', expiration_at_ms: FUTURE_MS }), NOW)).toBe(
      true,
    );
    // Paid window already ended → inactive.
    expect(resolveActive(event({ type: 'CANCELLATION', expiration_at_ms: PAST_MS }), NOW)).toBe(
      false,
    );
  });

  it('treats an unknown event with no expiry as inactive', () => {
    expect(resolveActive(event({ type: 'SOMETHING_NEW' }), NOW)).toBe(false);
  });
});

describe('parseRevenueCatEvent', () => {
  it('returns null when type is missing or not a string', () => {
    expect(parseRevenueCatEvent({})).toBeNull();
    expect(parseRevenueCatEvent({ type: 123 })).toBeNull();
  });

  it('extracts the fields we act on and tolerates extras', () => {
    const parsed = parseRevenueCatEvent({
      type: 'INITIAL_PURCHASE',
      id: 'evt_1',
      app_user_id: 'user_123',
      entitlement_ids: ['PackRat Pro'],
      expiration_at_ms: FUTURE_MS,
      store: 'APP_STORE',
      product_id: 'yearly',
      some_new_field: 'ignored',
    });
    expect(parsed).toMatchObject({
      type: 'INITIAL_PURCHASE',
      id: 'evt_1',
      app_user_id: 'user_123',
      entitlement_ids: ['PackRat Pro'],
      expiration_at_ms: FUTURE_MS,
      store: 'APP_STORE',
      product_id: 'yearly',
    });
  });

  it('falls back to the singular entitlement_id field', () => {
    const parsed = parseRevenueCatEvent({ type: 'RENEWAL', entitlement_id: 'PackRat Pro' });
    expect(parsed?.entitlement_id).toBe('PackRat Pro');
  });

  it('coerces wrong-typed fields to null rather than trusting them', () => {
    const parsed = parseRevenueCatEvent({
      type: 'RENEWAL',
      entitlement_ids: [1, 2, 3],
      expiration_at_ms: 'not-a-number',
    });
    expect(parsed?.entitlement_ids).toBeNull();
    expect(parsed?.expiration_at_ms).toBeNull();
  });
});
