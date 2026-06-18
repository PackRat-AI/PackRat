import { clientEnvs } from '@packrat/env/expo-client';
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

let initialized = false;

export function initRevenueCat(): void {
  const apiKey = Platform.select({
    ios: clientEnvs.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY,
    android: clientEnvs.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY,
    default: clientEnvs.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY,
  });

  if (!apiKey) {
    if (__DEV__) {
      console.warn('[RevenueCat] No API key configured — purchases disabled.');
    }
    return;
  }

  if (initialized) return;

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }

  Purchases.configure({ apiKey });
  initialized = true;
}

export function isRevenueCatInitialized(): boolean {
  return initialized;
}
