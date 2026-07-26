import { use$ } from '@legendapp/state/react';
import { userStore } from 'expo-app/features/auth/store';
import { useEffect } from 'react';
import { identifyRevenueCatUser, resetRevenueCatUser } from '../lib/revenueCat';

/**
 * Keeps the RevenueCat user identity in sync with the app's auth state.
 * Call this once at the app root after RevenueCat is configured.
 */
export function useRevenueCatUser() {
  const user = use$(userStore);

  useEffect(() => {
    if (user?.id) {
      identifyRevenueCatUser(user.id);
    } else {
      resetRevenueCatUser();
    }
  }, [user?.id]);
}
