import { createDb } from '@packrat/api/db';
import { captureApiException } from '@packrat/api/utils/sentry';
import {
  APP_CONFIG,
  FeatureFlag,
  isClientPlatform,
  resolveFlagsForPlatform,
} from '@packrat/config';
import { featureFlagPlatformOverrides, featureFlags } from '@packrat/db/schema';
import { eq } from 'drizzle-orm';

// All flag keys known to the codebase. Exported so the admin route can build
// a zod enum from it — that's the actual validation boundary for write paths.
export const KNOWN_FEATURE_FLAG_KEYS = Object.freeze(Object.values(FeatureFlag));

// Default lookup by a plain `string` key (e.g. from a DB row) rather than the
// narrow FeatureFlag literal union.
function getDefaultFlagValue(key: string): boolean {
  const defaults: Record<string, boolean> = APP_CONFIG.featureFlags;
  return defaults[key] ?? false;
}

export interface AdminFeatureFlagItem {
  key: string;
  defaultValue: boolean;
  override: boolean | null;
  effective: boolean;
  description: string | null;
  updatedAt: Date | null;
}

/**
 * Effective value for every known flag, optionally targeted at one platform.
 *
 * Resolution is three layers, most specific first: a platform override, the
 * global override, then the coded default. Powers the public, unauthenticated
 * route the clients fetch to resolve gating.
 *
 * `platform` comes from an untrusted query parameter. An unrecognised value is
 * ignored rather than rejected, and the caller gets globally-resolved flags —
 * an old client or a surface with no targeting (Expo on web) must not have
 * every flag dark-launched just because the server did not recognise it.
 */
export async function listEffectiveFeatureFlags(
  platform?: string,
): Promise<Record<string, boolean>> {
  const db = createDb();
  const defaults: Record<string, boolean> = { ...APP_CONFIG.featureFlags };

  try {
    const globalRows = await db.tag('featureFlags.listEffective').query.featureFlags.findMany({
      columns: { key: true, enabled: true },
    });
    const globalOverrides: Record<string, boolean> = {};
    for (const row of globalRows) globalOverrides[row.key] = row.enabled;

    // Only query platform rows when the caller named a platform we target.
    const platformOverrides: Record<string, boolean> = {};
    if (isClientPlatform(platform)) {
      const platformRows = await db
        .tag('featureFlags.listPlatformOverrides')
        .query.featureFlagPlatformOverrides.findMany({
          columns: { key: true, enabled: true },
          where: eq(featureFlagPlatformOverrides.platform, platform),
        });
      for (const row of platformRows) platformOverrides[row.key] = row.enabled;
    }

    return resolveFlagsForPlatform({ platformOverrides, globalOverrides, defaults });
  } catch (error) {
    captureApiException({
      error,
      operation: 'featureFlags.listEffective',
      tags: { feature: 'featureFlags' },
      extra: { platform },
    });
    throw error;
  }
}

/** Every known flag, with its coded default, any override, and the effective value. Admin-only. */
export async function listFeatureFlagsForAdmin(): Promise<AdminFeatureFlagItem[]> {
  const db = createDb();
  try {
    const overrides = await db.tag('featureFlags.listAdmin').query.featureFlags.findMany({
      columns: { key: true, enabled: true, description: true, updatedAt: true },
    });
    const overrideByKey = new Map(overrides.map((row) => [row.key, row]));
    return KNOWN_FEATURE_FLAG_KEYS.map((key) => {
      const defaultValue = getDefaultFlagValue(key);
      const override = overrideByKey.get(key);
      return {
        key,
        defaultValue,
        override: override ? override.enabled : null,
        effective: override ? override.enabled : defaultValue,
        description: override?.description ?? null,
        updatedAt: override?.updatedAt ?? null,
      };
    });
  } catch (error) {
    captureApiException({
      error,
      operation: 'featureFlags.listAdmin',
      tags: { feature: 'featureFlags' },
    });
    throw error;
  }
}

export async function upsertFeatureFlagOverride({
  key,
  enabled,
  description,
}: {
  key: string;
  enabled: boolean;
  description?: string | null;
}): Promise<AdminFeatureFlagItem> {
  const db = createDb();
  try {
    const [row] = await db
      .tag('featureFlags.upsert')
      .insert(featureFlags)
      .values({ key, enabled, description: description ?? null, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: featureFlags.key,
        set: { enabled, description: description ?? null, updatedAt: new Date() },
      })
      // Drizzle 0.45.x narrows the insert query type after `.onConflictDoUpdate()`
      // so the field-projected `.returning()` overload isn't visible — only the
      // no-arg version compiles (see the identical note in catalogService.ts).
      // featureFlags isn't a fat table so shipping the full (small) row is fine.
      .returning();
    if (!row) throw new Error('Failed to upsert feature flag override');
    return {
      key: row.key,
      defaultValue: getDefaultFlagValue(row.key),
      override: row.enabled,
      effective: row.enabled,
      description: row.description,
      updatedAt: row.updatedAt,
    };
  } catch (error) {
    captureApiException({
      error,
      operation: 'featureFlags.upsert',
      tags: { feature: 'featureFlags' },
      extra: { key },
    });
    throw error;
  }
}

/** Removes the override, reverting the key to its coded default. Returns false if none existed. */
export async function deleteFeatureFlagOverride(key: string): Promise<boolean> {
  const db = createDb();
  try {
    const deleted = await db
      .tag('featureFlags.delete')
      .delete(featureFlags)
      .where(eq(featureFlags.key, key))
      .returning();
    return deleted.length > 0;
  } catch (error) {
    captureApiException({
      error,
      operation: 'featureFlags.delete',
      tags: { feature: 'featureFlags' },
      extra: { key },
    });
    throw error;
  }
}
