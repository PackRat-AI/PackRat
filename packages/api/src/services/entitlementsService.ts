import { createDb } from '@packrat/api/db';
import { captureApiException } from '@packrat/api/utils/sentry';
import { PACKRAT_PRO_ENTITLEMENT } from '@packrat/config';
import { entitlements } from '@packrat/db';
import { asNumber, asString, isArray, isString } from '@packrat/guards';
import { and, eq, gt, isNull, or } from 'drizzle-orm';

/**
 * The subset of a RevenueCat webhook event we act on. RevenueCat sends many
 * fields; we read only what determines entitlement state. See
 * https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
 */
export interface RevenueCatEvent {
  type: string;
  id?: string;
  // The current app user id; when the user is identified this is our users.id.
  app_user_id?: string;
  original_app_user_id?: string;
  // Entitlements affected by this event. Newer events use `entitlement_ids`.
  entitlement_ids?: string[] | null;
  entitlement_id?: string | null;
  expiration_at_ms?: number | null;
  store?: string | null;
  product_id?: string | null;
}

/**
 * Narrow the untyped webhook JSON envelope into a `RevenueCatEvent`, reading
 * only the fields we act on. Returns null when the event has no string `type`
 * (the one field we require). Tolerant of the rest so new/absent fields don't
 * reject a valid webhook.
 */
export function parseRevenueCatEvent(raw: Record<string, unknown>): RevenueCatEvent | null {
  const type = asString(raw.type);
  if (type === undefined) return null;

  const asStringArray = (v: unknown): string[] | undefined =>
    isArray(v) && v.every(isString) ? v : undefined;

  return {
    type,
    id: asString(raw.id),
    app_user_id: asString(raw.app_user_id),
    original_app_user_id: asString(raw.original_app_user_id),
    entitlement_ids: asStringArray(raw.entitlement_ids) ?? null,
    entitlement_id: asString(raw.entitlement_id) ?? null,
    expiration_at_ms: asNumber(raw.expiration_at_ms) ?? null,
    store: asString(raw.store) ?? null,
    product_id: asString(raw.product_id) ?? null,
  };
}

// Event types that leave the user *with* the entitlement active. Everything
// else (expiration, cancellation that has lapsed, refunds, billing failure that
// revoked access) is treated as inactive.
const GRANTING_EVENT_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
  'REFUND_REVERSED', // a reversed refund restores access
]);

// Event types that revoke access outright regardless of the expiry timestamp.
const REVOKING_EVENT_TYPES = new Set(['EXPIRATION', 'REFUND']);

/**
 * Resolve whether an event leaves the entitlement active. A CANCELLATION only
 * means auto-renew was turned off — access continues until `expiration_at_ms`,
 * so we keep it active while the expiry is still in the future. EXPIRATION and
 * REFUND revoke immediately. Pure and exported for testing.
 *
 * @param now injectable clock for deterministic tests.
 */
export function resolveActive(event: RevenueCatEvent, now: Date = new Date()): boolean {
  if (REVOKING_EVENT_TYPES.has(event.type)) return false;
  if (GRANTING_EVENT_TYPES.has(event.type)) return true;
  // CANCELLATION / BILLING_ISSUE and anything else: still active only if the
  // access period hasn't ended yet.
  if (event.expiration_at_ms) return event.expiration_at_ms > now.getTime();
  return false;
}

/** Entitlement ids affected by an event, normalized across field shapes. */
function eventEntitlementIds(event: RevenueCatEvent): string[] {
  if (event.entitlement_ids && event.entitlement_ids.length > 0) return event.entitlement_ids;
  if (event.entitlement_id) return [event.entitlement_id];
  return [];
}

/**
 * Apply a RevenueCat webhook event to the entitlements table. Upserts one row
 * per affected (app_user_id, entitlement_id), so the table always reflects the
 * latest known state. Idempotent: re-delivering the same event converges to the
 * same row. Returns the number of entitlement rows written.
 */
export async function applyRevenueCatEvent(event: RevenueCatEvent): Promise<number> {
  const appUserId = event.app_user_id ?? event.original_app_user_id;
  if (!appUserId) return 0;

  const entitlementIds = eventEntitlementIds(event);
  if (entitlementIds.length === 0) return 0;

  const now = new Date();
  const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;
  const isActive = resolveActive(event, now);

  const db = createDb();
  try {
    for (const entitlementId of entitlementIds) {
      await db
        .tag('entitlements.upsert')
        .insert(entitlements)
        .values({
          rcAppUserId: appUserId,
          // When the RC app user id is our users.id this links the row; if it's
          // an anonymous RC id the FK stays null (the column is nullable).
          userId: appUserId,
          entitlementId,
          isActive,
          expiresAt,
          store: event.store ?? null,
          productId: event.product_id ?? null,
          lastEventId: event.id ?? null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [entitlements.rcAppUserId, entitlements.entitlementId],
          set: {
            isActive,
            expiresAt,
            store: event.store ?? null,
            productId: event.product_id ?? null,
            lastEventId: event.id ?? null,
            updatedAt: now,
          },
        });
    }
    return entitlementIds.length;
  } catch (error) {
    captureApiException({
      error,
      operation: 'entitlements.applyEvent',
      tags: { feature: 'entitlements' },
      extra: { appUserId, entitlementIds, eventType: event.type },
    });
    throw error;
  }
}

/**
 * Server-side source of truth for Pro status. True when the user has an active,
 * unexpired `PackRat Pro` entitlement row. `userId` is the app user id
 * RevenueCat reported (our users.id for identified users).
 */
export async function hasProEntitlement(userId: string): Promise<boolean> {
  const db = createDb();
  try {
    const row = await db.tag('entitlements.hasPro').query.entitlements.findFirst({
      columns: { id: true },
      where: and(
        eq(entitlements.rcAppUserId, userId),
        eq(entitlements.entitlementId, PACKRAT_PRO_ENTITLEMENT),
        eq(entitlements.isActive, true),
        // Active and either non-expiring or not yet expired.
        or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, new Date())),
      ),
    });
    return !!row;
  } catch (error) {
    captureApiException({
      error,
      operation: 'entitlements.hasPro',
      tags: { feature: 'entitlements' },
      extra: { userId },
    });
    throw error;
  }
}
