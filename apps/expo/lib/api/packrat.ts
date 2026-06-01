import { createApiClient } from '@packrat/api-client';
import { fromZod } from '@packrat/guards';
import { store } from 'expo-app/atoms/store';
import { needsReauthAtom } from 'expo-app/features/auth/atoms/authAtoms';
import { getApiBaseUrl } from 'expo-app/lib/api/getBaseUrl';
import { authClient } from 'expo-app/lib/auth-client';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { z } from 'zod';

// The expoClient plugin serialises all cookies into SecureStore under this key.
// Parsing it locally avoids a network round-trip on every API request.
const COOKIE_STORE_KEY = 'packrat_cookie';

const CookieStoreSchema = z.record(z.object({ value: z.string() }));

// expoClient stores cookies as JSON: { "better-auth.session_token": { value, expires } }
// HTTPS servers (remote dev/prod) prefix the cookie name with __Secure-; HTTP (local) does not.
// In-memory cache of the web session token. Invalidated by onNeedsReauth.
const WEB_TOKEN_CACHE_MS = 30_000;
let cachedToken: string | null = null;
let cachedTokenExpiresAt = 0;

function parseSessionToken(cookieJson: string | null): string | null {
  if (!cookieJson) return null;
  const cookies = fromZod(CookieStoreSchema)(JSON.parse(cookieJson));
  if (!cookies) return null;
  return (
    cookies['better-auth.session_token']?.value ??
    cookies['__Secure-better-auth.session_token']?.value ??
    null
  );
}

export const apiClient = createApiClient({
  baseUrl: getApiBaseUrl(),
  auth: {
    // Native: read from SecureStore where @better-auth/expo's expoClient
    // plugin persists the cookie — no network call per request.
    // Web: expoClient short-circuits on web (doesn't write to SecureStore),
    // and expo-secure-store ships an empty stub on web. Fall through to
    // authClient.getSession() with a small in-memory cache — better-auth's
    // /api/auth/get-session is rate-limited and apiClient runs it on every
    // call, so an uncached implementation 429s within seconds and 401s the
    // user out. The session token is valid for 7 days; 30s is conservative.
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
    // Better Auth has no separate refresh-token endpoint; the 7-day session
    // token is the only credential. Returning null here is intentional.
    getRefreshToken: () => null,
    onAccessTokenRefreshed: () => {},
    onNeedsReauth: async () => {
      // Invalidate the web token cache so the next request re-fetches.
      cachedToken = null;
      cachedTokenExpiresAt = 0;
      // A 401 can be transient (e.g. the server briefly returned an error).
      // Verify the session is actually gone before alarming the user.
      const { data } = await authClient.getSession();
      if (data?.session) return;
      store.set(needsReauthAtom, true);
    },
  },
});

export type PackRatApi = typeof apiClient;
