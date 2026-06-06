import { createApiClient } from '@packrat/api-client';
import { store } from 'expo-app/atoms/store';
import { needsReauthAtom } from 'expo-app/features/auth/atoms/authAtoms';
import { getApiBaseUrl } from 'expo-app/lib/api/getBaseUrl';
import { authClient, parseSessionToken } from 'expo-app/lib/auth-client';
import * as SecureStore from 'expo-app/lib/secureStore';
import { Platform } from 'react-native';

const COOKIE_STORE_KEY = 'packrat_cookie';

// On web expoClient short-circuits and expo-secure-store is an empty stub, so
// we fall back to authClient.getSession(). Cache the token for 30s to keep
// apiClient's per-request token lookup from tripping Better Auth's prod
// rate limit. Invalidated by onNeedsReauth.
const WEB_TOKEN_CACHE_MS = 30_000;
let cachedToken: string | null = null;
let cachedTokenExpiresAt = 0;
let pendingTokenRequest: Promise<string | null> | null = null;

export const apiClient = createApiClient({
  baseUrl: getApiBaseUrl(),
  auth: {
    getAccessToken: async () => {
      if (Platform.OS === 'web') {
        const now = Date.now();
        if (cachedToken && now < cachedTokenExpiresAt) return cachedToken;
        pendingTokenRequest ??= authClient
          .getSession()
          .then(({ data }) => {
            cachedToken = data?.session?.token ?? null;
            cachedTokenExpiresAt = Date.now() + WEB_TOKEN_CACHE_MS;
            return cachedToken;
          })
          .finally(() => {
            pendingTokenRequest = null;
          });
        return pendingTokenRequest;
      }
      const cookieStr = await SecureStore.getItemAsync(COOKIE_STORE_KEY);
      return parseSessionToken(cookieStr);
    },
    // Better Auth has no separate refresh-token endpoint; the 7-day session
    // token is the only credential. Returning null here is intentional.
    getRefreshToken: () => null,
    onAccessTokenRefreshed: () => {},
    onNeedsReauth: async () => {
      cachedToken = null;
      cachedTokenExpiresAt = 0;
      pendingTokenRequest = null;
      // 401 can be transient; verify the session is really gone before
      // bouncing the user.
      const { data } = await authClient.getSession();
      if (data?.session) return;
      store.set(needsReauthAtom, true);
    },
  },
});

export type PackRatApi = typeof apiClient;
