// Re-exported from the shared config so the app and API agree on the Pro
// entitlement identifier (see @packrat/config's featureAccess).
export { PACKRAT_PRO_ENTITLEMENT } from '@packrat/config';

// RC dashboard offering identifiers — must match keys in the RC dashboard.
export const PACKRAT_PRO_OFFERING_ID = 'default';
export const PACKRAT_EARLY_ACCESS_OFFERING_ID = 'earlyaccessmodel';

export type ProductId = 'lifetime' | 'yearly' | 'monthly';

export type PurchaseResult = 'purchased' | 'cancelled' | 'error';
