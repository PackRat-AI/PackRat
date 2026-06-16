import { expoClient } from '@better-auth/expo/client';
import { asString, fromZod } from '@packrat/guards';
import { createAuthClient } from 'better-auth/react';
import { getApiBaseUrl } from 'expo-app/lib/api/getBaseUrl';
import * as SecureStore from 'expo-app/lib/secureStore';
import { z } from 'zod';

const COOKIE_STORE_KEY = 'packrat_cookie';
const CookieStoreSchema = z.record(z.object({ value: z.unknown().optional() }));

// expoClient stores cookies as JSON: { "better-auth.session_token": { value, expires } }
// HTTPS servers (remote dev/prod) prefix the cookie name with __Secure-; HTTP (local) does not.
export function parseSessionToken(cookieJson: string | null): string | null {
  if (!cookieJson) return null;
  try {
    const cookies = fromZod(CookieStoreSchema)(JSON.parse(cookieJson));
    if (!cookies) return null;
    const token =
      cookies['better-auth.session_token']?.value ??
      cookies['__Secure-better-auth.session_token']?.value;
    const sessionToken = asString(token);
    return sessionToken && sessionToken.length > 0 ? sessionToken : null;
  } catch {
    return null;
  }
}

export async function getStoredSessionToken(): Promise<string | null> {
  return parseSessionToken(await SecureStore.getItemAsync(COOKIE_STORE_KEY));
}

export const authClient = createAuthClient({
  baseURL: getApiBaseUrl(),
  // Send cookies for web/e2e and attach the stored Better Auth token when the
  // expo plugin has one available.
  fetchOptions: {
    credentials: 'include',
    timeout: 30000,
    onRequest: async (context) => {
      if (!context.headers.has('authorization')) {
        const token = await getStoredSessionToken();
        if (token) context.headers.set('authorization', `Bearer ${token}`);
      }
      return context;
    },
  },
  plugins: [
    expoClient({
      scheme: 'packrat',
      storagePrefix: 'packrat',
      // secureStore wraps expo-secure-store; its web variant backs to
      // localStorage so the auth client works in the browser.
      storage: { setItem: SecureStore.setItem, getItem: SecureStore.getItem },
    }),
  ],
});

export type BetterAuthSession = typeof authClient.$Infer.Session;

export async function getActiveToken(): Promise<string | null> {
  const { data } = await authClient.getSession();
  return data?.session?.token ?? null;
}
