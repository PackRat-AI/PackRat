import { safeJsonParse, safeJsonStringify } from '@packrat/utils';
import * as Sentry from '@sentry/react-native';
import AsyncStorage from 'expo-app/lib/asyncStorage';
import type { CustomerInfo } from 'react-native-purchases';

// The RevenueCat SDK caches customerInfo natively and `getCustomerInfo()`
// returns it offline, but React Query starts each cold launch with `undefined`
// until that first async call resolves. Persisting the last-known customerInfo
// lets the early-access gate seed a resolved Pro signal *synchronously* on
// mount, so it never reads a transient `undefined` as "not Pro" and never
// flashes the paywall at a subscriber while the SDK warms up.
const STORAGE_KEY = 'purchases.customerInfo.v1';

/** Persist the latest customerInfo. Best-effort — failures are non-fatal. */
export async function persistCustomerInfo(info: CustomerInfo): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, safeJsonStringify(info));
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'purchases', action: 'persistCustomerInfo' },
    });
  }
}

/** Read the last-known customerInfo, or null if none was ever persisted. */
export async function readPersistedCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? safeJsonParse<CustomerInfo>(raw, { strict: true }) : null;
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'purchases', action: 'readPersistedCustomerInfo' },
    });
    return null;
  }
}
