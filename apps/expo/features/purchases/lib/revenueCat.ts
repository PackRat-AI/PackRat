import { clientEnvs } from '@packrat/env/expo-client';
import * as Sentry from '@sentry/react-native';
import Purchases, { type CustomerInfo, LOG_LEVEL } from 'react-native-purchases';

/**
 * RevenueCat integration for Android.
 *
 * Mirrors `apps/swift/Sources/PackRat/Subscriptions/SubscriptionService.swift`:
 * same single entitlement, same app-user-id convention (the RevenueCat app user
 * id *is* our `users.id`, which is what lets the webhook attribute an
 * entitlement row to an account), and the same no-op-when-unconfigured
 * behaviour.
 *
 * Guests can see the paywall and its prices, but not buy — see
 * `assertPurchasableIdentity` and ADR-006 in
 * `docs/features/early-access-subscriptions.md`.
 */

/**
 * Whether an API key was supplied at build time. When false the SDK is never
 * configured and every entitlement read resolves to "not Pro", so a keyless
 * build leaves gated features closed rather than crashing or silently opening
 * them.
 */
export function isRevenueCatConfigured(): boolean {
  return !!clientEnvs.EXPO_PUBLIC_REVENUECAT_API_KEY;
}

/** Set once `configureRevenueCat` has actually run, so it runs only once. */
let hasConfigured = false;

/**
 * Configures the SDK so prices can be fetched.
 *
 * Deliberately called from the first render rather than at module scope:
 * Android may start the process in the background — a widget update, a push,
 * a `BOOT_COMPLETED` receiver — and configuring there mints a RevenueCat
 * customer record for a launch no person ever saw. Those records are
 * indistinguishable from real ones in the dashboard and quietly skew every
 * conversion figure computed from customer counts.
 *
 * Configuring puts the SDK on an anonymous id, which is fine — offerings are
 * public catalogue data and a paywall has to show prices before anyone signs
 * in. What must not happen is a *purchase* against that anonymous id, since it
 * belongs to no PackRat account; `assertPurchasableIdentity` enforces that.
 * See ADR-006.
 */
export function configureRevenueCat() {
  if (hasConfigured) return;

  const apiKey = clientEnvs.EXPO_PUBLIC_REVENUECAT_API_KEY;
  if (!apiKey) return;

  try {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
    }
    Purchases.configure({ apiKey });
    hasConfigured = true;
    Sentry.addBreadcrumb({
      category: 'purchases',
      message: 'RevenueCat configured',
      level: 'info',
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'purchases', action: 'configure' },
    });
  }
}

/**
 * Associates purchases with a signed-in PackRat user.
 *
 * The RevenueCat app user id is our `users.id`, which is the join the webhook
 * relies on to write an entitlement row against the right account. Getting
 * this wrong means a real purchase never reaches the database.
 *
 * `logIn` also transfers an anonymous id's purchases onto the account, so a
 * guest who subscribed and then signed up keeps what they paid for. The
 * returned info already reflects that merge, which is why it is returned for
 * the caller to apply rather than left for the next scheduled refresh — a
 * refresh that may be five minutes away, or never if the device goes offline.
 *
 * Returns null if the SDK is unconfigured or the call failed.
 */
export async function identifyRevenueCatUser(userId: string): Promise<CustomerInfo | null> {
  if (!isRevenueCatConfigured()) return null;

  try {
    const { customerInfo } = await Purchases.logIn(userId);
    Sentry.addBreadcrumb({
      category: 'purchases',
      message: 'RevenueCat user identified',
      level: 'info',
    });
    return customerInfo;
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'purchases', action: 'logIn' },
      extra: { userId },
    });
    return null;
  }
}

/**
 * Returns purchases to an anonymous id on sign-out, so the next user on this
 * device does not inherit the previous one's entitlements.
 */
export async function resetRevenueCatUser() {
  if (!isRevenueCatConfigured()) return;

  try {
    await Purchases.logOut();
    Sentry.addBreadcrumb({
      category: 'purchases',
      message: 'RevenueCat user reset',
      level: 'info',
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'purchases', action: 'logOut' },
    });
  }
}

/** Thrown when a purchase is attempted with no PackRat account to attach it to. */
export class PurchaseAccountRequiredError extends Error {
  constructor() {
    super('A PackRat account is required to subscribe.');
    this.name = 'PurchaseAccountRequiredError';
  }
}

/**
 * Refuses a purchase while the SDK is on an anonymous identity.
 *
 * RevenueCat is configured for everyone so prices can load, which leaves the
 * SDK anonymous until sign-in. A subscription bought against that id cannot be
 * resolved later if the buyer signs into an account that already exists: the
 * entitlement either follows the store account off whichever PackRat account
 * held it, or strands where nobody can reach it. Neither is discoverable until
 * after the money is taken.
 *
 * The paywall routes guests to sign-in before they get here; this is the
 * backstop for any future call site that forgets. See ADR-006.
 */
export async function assertPurchasableIdentity(): Promise<void> {
  if (await Purchases.isAnonymous()) {
    throw new PurchaseAccountRequiredError();
  }
}
