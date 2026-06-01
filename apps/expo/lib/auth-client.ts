import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import { getApiBaseUrl } from 'expo-app/lib/api/getBaseUrl';
import * as SecureStore from 'expo-secure-store';

export const authClient = createAuthClient({
  baseURL: getApiBaseUrl(),
  // Web: the API origin differs from the page origin (Expo web on :18082,
  // API on :18787, prod web at packrat.world / api.packrat.world), so the
  // browser drops the better-auth session cookie unless we explicitly opt
  // into credentials. @better-auth/expo's plugin sets credentials='omit'
  // in its `init()` hook on native (cookies are managed via SecureStore
  // there), but that init() short-circuits with `if (isWeb) return;` —
  // so this top-level option only takes effect on web.
  fetchOptions: { credentials: 'include' },
  plugins: [
    expoClient({
      scheme: 'packrat',
      storagePrefix: 'packrat',
      storage: {
        setItem: (key: string, value: string) => SecureStore.setItem(key, value),
        getItem: (key: string) => SecureStore.getItem(key),
      },
    }),
  ],
});

export type BetterAuthSession = typeof authClient.$Infer.Session;

export async function getActiveToken(): Promise<string | null> {
  const { data } = await authClient.getSession();
  return data?.session?.token ?? null;
}
