import { createDb } from '@packrat/api/db';
import { captureApiException } from '@packrat/api/utils/sentry';
import { hasFeatureAccess } from '@packrat/config';
import { featureAccess } from '@packrat/db';
import { eq } from 'drizzle-orm';

/**
 * Public shape of a feature-access row sent to clients. Excludes bookkeeping
 * columns (`releasedAt`, `createdAt`, `updatedAt`) the resolver doesn't need.
 */
export interface FeatureAccessConfig {
  key: string;
  label: string;
  earlyAccessUntil: Date | null;
}

/**
 * List the full feature-access config — the small, global table of features
 * that are (or recently were) in an early-access window. Non-sensitive: the
 * client fetches it to know which features to gate, then resolves each against
 * the viewer's Pro entitlement via `hasFeatureAccess`.
 */
export async function listFeatureAccess(): Promise<FeatureAccessConfig[]> {
  const db = createDb();
  try {
    return await db.tag('featureAccess.list').query.featureAccess.findMany({
      columns: { key: true, label: true, earlyAccessUntil: true },
    });
  } catch (error) {
    captureApiException({
      error,
      operation: 'featureAccess.list',
      tags: { feature: 'featureAccess' },
    });
    throw error;
  }
}

/**
 * Server-side enforcement for an early-access feature. Returns whether the
 * viewer may use `key` right now, given their Pro entitlement. Features without
 * a row (or already graduated) resolve to allowed — the model never locks a
 * user out of something that isn't actively gated.
 *
 * Wire this into a route only once the request can resolve `hasPro` from the
 * RevenueCat entitlement; until the first feature is gated server-side, gating
 * lives in the mobile UI.
 */
export async function canAccessFeature(key: string, hasPro: boolean): Promise<boolean> {
  const db = createDb();
  try {
    const feature = await db.tag('featureAccess.get').query.featureAccess.findFirst({
      columns: { earlyAccessUntil: true },
      where: eq(featureAccess.key, key),
    });
    return hasFeatureAccess(feature, { hasPro });
  } catch (error) {
    captureApiException({
      error,
      operation: 'featureAccess.canAccess',
      tags: { feature: 'featureAccess' },
      extra: { key },
    });
    throw error;
  }
}
