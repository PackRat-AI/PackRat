import { canAccessFeature, hasProEntitlement } from '@packrat/api/services';
import { apiAddBreadcrumb, captureApiException } from '@packrat/api/utils/sentry';
import { status } from 'elysia';

/**
 * Server-side early-access enforcement, mirroring the mobile `EarlyAccessGate`.
 *
 * Resolves the viewer's Pro status from the entitlements table (the RevenueCat
 * webhook's source of truth) and combines it with the feature's early-access
 * config via the shared `canAccessFeature` resolver. Returns an Elysia 403
 * `status` response to return early from the handler when access is denied, or
 * `null` when the viewer may proceed.
 *
 * Usage inside an authenticated handler:
 *   const denied = await enforceFeatureAccess('wildlife', user.userId);
 *   if (denied) return denied;
 */
export async function enforceFeatureAccess(featureKey: string, userId: string) {
  try {
    const hasPro = await hasProEntitlement(userId);
    const allowed = await canAccessFeature(featureKey, hasPro);
    if (allowed) return null;

    apiAddBreadcrumb({
      category: 'featureAccess',
      message: 'Server-side early-access gate denied request',
      level: 'info',
      data: { featureKey, userId, hasPro },
    });
    return status(403, {
      error: 'This feature is in early access for Pro members.',
      code: 'FEATURE_EARLY_ACCESS',
      feature: featureKey,
    });
  } catch (error) {
    captureApiException({
      error,
      operation: 'featureGate.enforce',
      userId,
      tags: { feature: 'featureAccess' },
      extra: { featureKey },
    });
    throw error;
  }
}
