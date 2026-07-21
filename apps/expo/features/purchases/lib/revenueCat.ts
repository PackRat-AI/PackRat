import { clientEnvs } from '@packrat/env/expo-client';
import * as Sentry from '@sentry/react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

export function isRevenueCatConfigured(): boolean {
  return !!clientEnvs.EXPO_PUBLIC_REVENUECAT_API_KEY;
}

export function configureRevenueCat() {
  const apiKey = clientEnvs.EXPO_PUBLIC_REVENUECAT_API_KEY;
  if (!apiKey) return;

  try {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
    }
    Purchases.configure({ apiKey });
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

export async function identifyRevenueCatUser(userId: string) {
  try {
    await Purchases.logIn(userId);
    Sentry.addBreadcrumb({
      category: 'purchases',
      message: 'RevenueCat user identified',
      level: 'info',
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'purchases', action: 'logIn' },
      extra: { userId },
    });
  }
}

export async function resetRevenueCatUser() {
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
