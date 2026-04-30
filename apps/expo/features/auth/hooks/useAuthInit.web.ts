import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { isAuthed } from '../store';

/**
 * Web version of useAuthInit.
 * Removes native Google Sign-In configuration (SDK is mobile-only).
 * Uses localStorage directly for token/skip-login checks.
 * Metro automatically picks this file over useAuthInit.ts for web builds.
 */
export function useAuthInit() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsLoading(true);

        const hasSkippedLogin = localStorage.getItem('skipped_login');
        const accessToken = localStorage.getItem('access_token');

        if (accessToken || hasSkippedLogin === 'true') {
          if (accessToken) isAuthed.set(true);
          setIsLoading(false);
          return;
        }

        router.replace({
          pathname: '/auth',
          params: { showSkipLoginBtn: 'true', redirectTo: '/' },
        });
      } catch (error) {
        console.error('Failed to load user session:', error);
        router.replace('/auth');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return isLoading;
}
