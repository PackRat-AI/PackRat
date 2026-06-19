import * as Sentry from '@sentry/react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

// RevenueCat public API key — not a secret, safe to embed in the app bundle.
const REVENUECAT_API_KEY = 'test_rmRjXKZMmykOaEhtvmoRYtqmVGA';

export function configureRevenueCat() {
  try {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
    }
    Purchases.configure({ apiKey: REVENUECAT_API_KEY });
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
