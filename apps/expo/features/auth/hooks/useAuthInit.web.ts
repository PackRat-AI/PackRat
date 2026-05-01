import { router } from 'expo-router';
import { useEffect, useState } from 'react';

/**
 * Web version of useAuthInit.
 * Removes native Google Sign-In configuration (SDK is mobile-only).
 * Uses localStorage directly for token/skip-login checks.
 * Metro automatically picks this file over useAuthInit.ts for web builds.
 */
export function useAuthInit() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const hasSkippedLogin = localStorage.getItem('skipped_login');
    const accessToken = localStorage.getItem('access_token');

    if (accessToken || hasSkippedLogin === 'true') {
      setIsLoading(false);
      return;
    }

    setIsLoading(false);

    // Defer past React's commit phase so NavigationContainer is ready.
    // On web, effects can fire before expo-router's navigationRef.isReady()
    // returns true (especially in Strict Mode's double-mount).
    const timer = setTimeout(() => {
      router.replace({ pathname: '/auth', params: { showSkipLoginBtn: 'true', redirectTo: '/' } });
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  return isLoading;
}
