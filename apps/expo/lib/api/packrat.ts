import { createApiClient } from '@packrat/api-client';
import { clientEnvs } from '@packrat/env/expo-client';
import { fromZod } from '@packrat/guards';
import { store } from 'expo-app/atoms/store';
import { needsReauthAtom } from 'expo-app/features/auth/atoms/authAtoms';
import { authClient } from 'expo-app/lib/auth-client';
import { secureStorage } from 'expo-app/lib/secureStorage';
import { Platform } from 'react-native';
import { z } from 'zod';

// The expoClient plugin serialises all cookies into SecureStore under this key.
// Parsing it locally avoids a network round-trip on every API request.
const COOKIE_STORE_KEY = 'packrat_cookie';

const CookieStoreSchema = z.record(z.object({ value: z.string() }));

// expoClient stores cookies as JSON: { "better-auth.session_token": { value, expires } }
// HTTPS servers (remote dev/prod) prefix the cookie name with __Secure-; HTTP (local) does not.
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

const fetchWithWebCredentials = Object.assign(
  (input: RequestInfo | URL, init?: RequestInit) =>
    fetch(
      input,
      Platform.OS === 'web' ? { ...init, credentials: init?.credentials ?? 'include' } : init,
    ),
  { preconnect: fetch.preconnect },
);

export const apiClient = createApiClient({
  baseUrl: clientEnvs.EXPO_PUBLIC_API_URL,
  fetcher: fetchWithWebCredentials,
  auth: {
    // Read the token from SecureStore — no network call on every API request.
    getAccessToken: async () => {
      const cookieStr = await secureStorage.getItemAsync(COOKIE_STORE_KEY);
      return parseSessionToken(cookieStr);
    },
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
