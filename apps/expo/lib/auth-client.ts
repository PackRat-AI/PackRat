import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import { getApiBaseUrl } from 'expo-app/lib/api/getBaseUrl';
import * as SecureStore from 'expo-app/lib/secureStore';

export const authClient = createAuthClient({
  baseURL: getApiBaseUrl(),
  // Send the Better Auth session cookie on cross-origin requests (the web app is
  // served from a different origin than the API in dev/e2e). Without this,
  // getSession() omits the cookie, returns null, and the app never becomes
  // authenticated on web. Harmless on native (bearer token via expoClient).
  fetchOptions: { credentials: 'include' },
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
