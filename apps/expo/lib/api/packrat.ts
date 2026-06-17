import { createApiClient } from '@packrat/api-client';
import { store } from 'expo-app/atoms/store';
import { needsReauthAtom } from 'expo-app/features/auth/atoms/authAtoms';
import { getApiBaseUrl } from 'expo-app/lib/api/getBaseUrl';
import { authClient, getStoredSessionToken } from 'expo-app/lib/auth-client';

export const apiClient = createApiClient({
  baseUrl: getApiBaseUrl(),
  auth: {
    // Read the token from SecureStore — no network call on every API request.
    getAccessToken: getStoredSessionToken,
    // Better Auth has no separate refresh-token endpoint; the 7-day session
    // token is the only credential. Returning null here is intentional.
    getRefreshToken: () => null,
    onAccessTokenRefreshed: () => {},
    onNeedsReauth: async () => {
      // A 401 can be transient (e.g. the server briefly returned an error).
      // Verify the session is actually gone before alarming the user.
      const { data } = await authClient.getSession();
      if (data?.session) return;
      store.set(needsReauthAtom, true);
    },
  },
});

export type PackRatApi = typeof apiClient;
