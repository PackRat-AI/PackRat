import { createApiClient } from '@packrat/api-client';
import { fromZod } from '@packrat/guards';
import { store } from 'expo-app/atoms/store';
import { needsReauthAtom } from 'expo-app/features/auth/atoms/authAtoms';
import { getApiBaseUrl } from 'expo-app/lib/api/getBaseUrl';
import { authClient } from 'expo-app/lib/auth-client';
import * as SecureStore from 'expo-app/lib/secureStore';
import { Platform } from 'react-native';
import { z } from 'zod';

// expoClient serialises cookies into SecureStore under this key on native.
const COOKIE_STORE_KEY = 'packrat_cookie';

const CookieStoreSchema = z.record(z.object({ value: z.string() }));

// On web expoClient short-circuits and expo-secure-store is an empty stub, so
// we fall back to authClient.getSession(). Cache the token for 30s to keep
// apiClient's per-request token lookup from tripping Better Auth's prod
// rate limit. Invalidated by onNeedsReauth.
const WEB_TOKEN_CACHE_MS = 30_000;
let cachedToken: string | null = null;
let cachedTokenExpiresAt = 0;

function parseSessionToken(cookieJson: string | null): string | null {
  if (!cookieJson) return null;
  const cookies = fromZod(CookieStoreSchema)(JSON.parse(cookieJson));
  if (!cookies) return null;
  // HTTPS prod prefixes the cookie with __Secure-; HTTP local doesn't.
  return (
    cookies['better-auth.session_token']?.value ??
    cookies['__Secure-better-auth.session_token']?.value ??
    null
  );
}

export const apiClient = createApiClient({
  baseUrl: getApiBaseUrl(),
  auth: {
    getAccessToken: async () => {
      if (Platform.OS === 'web') {
        const now = Date.now();
        if (cachedToken && now < cachedTokenExpiresAt) return cachedToken;
        const { data } = await authClient.getSession();
        cachedToken = data?.session?.token ?? null;
        cachedTokenExpiresAt = now + WEB_TOKEN_CACHE_MS;
        return cachedToken;
      }
      const cookieStr = await SecureStore.getItemAsync(COOKIE_STORE_KEY);
      return parseSessionToken(cookieStr);
    },
    // Better Auth has no separate refresh-token endpoint.
    getRefreshToken: () => null,
    onAccessTokenRefreshed: () => {},
    onNeedsReauth: async () => {
      cachedToken = null;
      cachedTokenExpiresAt = 0;
      // 401 can be transient; verify the session is really gone before
      // bouncing the user.
      const { data } = await authClient.getSession();
      if (data?.session) return;
      store.set(needsReauthAtom, true);
    },
  },
});

export type PackRatApi = typeof apiClient;
