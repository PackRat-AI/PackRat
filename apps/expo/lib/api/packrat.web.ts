import { createApiClient } from '@packrat/api-client';
import { clientEnvs } from '@packrat/env/expo-client';
import { store } from 'expo-app/atoms/store';
import { needsReauthAtom } from 'expo-app/features/auth/atoms/authAtoms';
import { authClient, getActiveToken } from 'expo-app/lib/auth-client';

// On web, expo-secure-store's ExpoSecureStore.web.js is an empty object so
// SecureStore.getItemAsync throws at runtime.  Use getActiveToken() instead,
// which reads the session token from authClient.getSession().  In E2E tests
// that call is intercepted by a Playwright route mock; in production it relies
// on the browser's native cookie handling via Better Auth.
export const apiClient = createApiClient({
  baseUrl: clientEnvs.EXPO_PUBLIC_API_URL,
  auth: {
    getAccessToken: getActiveToken,
    getRefreshToken: () => null,
    onAccessTokenRefreshed: () => {},
    onNeedsReauth: async () => {
      const { data } = await authClient.getSession();
      if (data?.session) return;
      store.set(needsReauthAtom, true);
    },
  },
});

export type PackRatApi = typeof apiClient;
