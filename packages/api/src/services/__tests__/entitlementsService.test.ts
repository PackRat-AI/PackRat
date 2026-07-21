import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const findFirst = vi.fn();
  const onConflictDoUpdate = vi.fn();
  return {
    findFirst,
    onConflictDoUpdate,
    captureApiException: vi.fn(),
    createDb: vi.fn(() => {
      const db = {
        tag: (_label: string) => db,
        query: { entitlements: { findFirst } },
        insert: (_table: unknown) => ({
          values: (_values: unknown) => ({ onConflictDoUpdate }),
        }),
      };
      return db;
    }),
  };
});

vi.mock('@packrat/api/db', () => ({ createDb: mocks.createDb }));
vi.mock('@packrat/api/utils/sentry', () => ({ captureApiException: mocks.captureApiException }));
vi.mock('@packrat/db', () => ({
  entitlements: { rcAppUserId: 'rcAppUserId', entitlementId: 'entitlementId' },
}));
vi.mock('drizzle-orm', () => ({
  and: (...conds: unknown[]) => ({ and: conds }),
  eq: (col: unknown, val: unknown) => ({ eq: [col, val] }),
  gt: (col: unknown, val: unknown) => ({ gt: [col, val] }),
  isNull: (col: unknown) => ({ isNull: col }),
  or: (...conds: unknown[]) => ({ or: conds }),
}));

import {
  applyRevenueCatEvent,
  hasProEntitlement,
  parseRevenueCatEvent,
  type RevenueCatEvent,
  resolveActive,
} from '../entitlementsService';

const NOW = new Date('2026-07-15T00:00:00.000Z');
const FUTURE_MS = new Date('2026-08-15T00:00:00.000Z').getTime();
const PAST_MS = new Date('2026-06-15T00:00:00.000Z').getTime();

function event(overrides: Partial<RevenueCatEvent> & { type: string }): RevenueCatEvent {
  return { entitlement_ids: ['PackRat Pro'], ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
});

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

  it('defaults now to the current clock when omitted', () => {
    // A cancellation expiring far in the future is active without an explicit now.
    const far = Date.now() + 1_000_000;
    expect(resolveActive(event({ type: 'CANCELLATION', expiration_at_ms: far }))).toBe(true);
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

describe('applyRevenueCatEvent', () => {
  it('returns 0 without touching the DB when there is no app user id', async () => {
    const written = await applyRevenueCatEvent(event({ type: 'RENEWAL' }));
    expect(written).toBe(0);
    expect(mocks.createDb).not.toHaveBeenCalled();
  });

  it('returns 0 when the event affects no entitlements', async () => {
    const written = await applyRevenueCatEvent({
      type: 'RENEWAL',
      app_user_id: 'user_1',
      entitlement_ids: [],
      entitlement_id: null,
    });
    expect(written).toBe(0);
    expect(mocks.createDb).not.toHaveBeenCalled();
  });

  it('upserts one active row per affected entitlement and returns the count', async () => {
    mocks.onConflictDoUpdate.mockResolvedValue(undefined);

    const written = await applyRevenueCatEvent({
      type: 'INITIAL_PURCHASE',
      id: 'evt_9',
      app_user_id: 'user_1',
      entitlement_ids: ['PackRat Pro', 'PackRat Plus'],
      expiration_at_ms: Date.now() + 1_000_000,
      store: 'APP_STORE',
      product_id: 'yearly',
    });

    expect(written).toBe(2);
    expect(mocks.onConflictDoUpdate).toHaveBeenCalledTimes(2);
  });

  it('falls back to original_app_user_id and the singular entitlement_id', async () => {
    mocks.onConflictDoUpdate.mockResolvedValue(undefined);

    const written = await applyRevenueCatEvent({
      type: 'RENEWAL',
      original_app_user_id: 'anon_rc_id',
      entitlement_id: 'PackRat Pro',
      expiration_at_ms: null,
    });

    expect(written).toBe(1);
    expect(mocks.onConflictDoUpdate).toHaveBeenCalledTimes(1);
  });

  it('captures and rethrows on a DB error', async () => {
    const boom = new Error('db down');
    mocks.onConflictDoUpdate.mockRejectedValue(boom);

    await expect(
      applyRevenueCatEvent({
        type: 'RENEWAL',
        app_user_id: 'user_1',
        entitlement_ids: ['PackRat Pro'],
      }),
    ).rejects.toBe(boom);
    expect(mocks.captureApiException).toHaveBeenCalledWith(
      expect.objectContaining({ error: boom, operation: 'entitlements.applyEvent' }),
    );
  });
});

describe('hasProEntitlement', () => {
  it('is true when an active Pro row exists', async () => {
    mocks.findFirst.mockResolvedValue({ id: 'ent_1' });
    await expect(hasProEntitlement('user_1')).resolves.toBe(true);
  });

  it('is false when no matching row exists', async () => {
    mocks.findFirst.mockResolvedValue(undefined);
    await expect(hasProEntitlement('user_1')).resolves.toBe(false);
  });

  it('captures and rethrows on a DB error', async () => {
    const boom = new Error('db down');
    mocks.findFirst.mockRejectedValue(boom);

    await expect(hasProEntitlement('user_1')).rejects.toBe(boom);
    expect(mocks.captureApiException).toHaveBeenCalledWith(
      expect.objectContaining({ error: boom, operation: 'entitlements.hasPro' }),
    );
  });
});
