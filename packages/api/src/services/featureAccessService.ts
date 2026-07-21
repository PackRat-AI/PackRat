import { createDb } from '@packrat/api/db';
import { captureApiException } from '@packrat/api/utils/sentry';
import { hasFeatureAccess } from '@packrat/config';
import { type FeatureAccess, featureAccess } from '@packrat/db';
import { eq } from 'drizzle-orm';

/**
 * Public shape of a feature-access row sent to clients. Excludes bookkeeping
 * columns (`releasedAt`, `createdAt`, `updatedAt`) the resolver doesn't need.
 */
export interface FeatureAccessConfig {
  key: string;
  label: string;
  description: string | null;
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
      columns: { key: true, label: true, description: true, earlyAccessUntil: true },
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

/** Full rows (incl. bookkeeping columns) for the admin CRUD UI. */
export async function listFeatureAccessForAdmin(): Promise<FeatureAccess[]> {
  const db = createDb();
  try {
    return await db.tag('featureAccess.listAdmin').query.featureAccess.findMany();
  } catch (error) {
    captureApiException({
      error,
      operation: 'featureAccess.listAdmin',
      tags: { feature: 'featureAccess' },
    });
    throw error;
  }
}

export async function createFeatureAccess({
  key,
  label,
  description,
  earlyAccessUntil,
}: {
  key: string;
  label: string;
  description?: string | null;
  earlyAccessUntil?: Date | null;
}): Promise<FeatureAccess> {
  const db = createDb();
  try {
    const [row] = await db
      .tag('featureAccess.create')
      .insert(featureAccess)
      .values({
        key,
        label,
        description: description ?? null,
        earlyAccessUntil: earlyAccessUntil ?? null,
      })
      .returning();
    if (!row) throw new Error('Failed to create feature-access row');
    return row;
  } catch (error) {
    captureApiException({
      error,
      operation: 'featureAccess.create',
      tags: { feature: 'featureAccess' },
      extra: { key },
    });
    throw error;
  }
}

/** Returns null if no row exists for `key`. */
export async function updateFeatureAccess(
  key: string,
  updates: { label?: string; description?: string | null; earlyAccessUntil?: Date | null },
): Promise<FeatureAccess | null> {
  const db = createDb();
  try {
    const [row] = await db
      .tag('featureAccess.update')
      .update(featureAccess)
      .set({
        updatedAt: new Date(),
        ...(updates.label !== undefined && { label: updates.label }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.earlyAccessUntil !== undefined && {
          earlyAccessUntil: updates.earlyAccessUntil,
        }),
      })
      .where(eq(featureAccess.key, key))
      .returning();
    return row ?? null;
  } catch (error) {
    captureApiException({
      error,
      operation: 'featureAccess.update',
      tags: { feature: 'featureAccess' },
      extra: { key },
    });
    throw error;
  }
}

/** Removes the row — the feature becomes fully ungated (resolver fails open). */
export async function deleteFeatureAccess(key: string): Promise<boolean> {
  const db = createDb();
  try {
    const deleted = await db
      .tag('featureAccess.delete')
      .delete(featureAccess)
      .where(eq(featureAccess.key, key))
      .returning();
    return deleted.length > 0;
  } catch (error) {
    captureApiException({
      error,
      operation: 'featureAccess.delete',
      tags: { feature: 'featureAccess' },
      extra: { key },
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
