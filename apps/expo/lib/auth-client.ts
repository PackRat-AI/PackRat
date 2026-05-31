import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import { getApiBaseUrl } from 'expo-app/lib/api/getBaseUrl';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// expo-secure-store ships an empty stub on web (ExpoSecureStore.web.js = {}).
// Calling setItem/getItem there throws because the underlying sync native
// methods don't exist. Fall back to localStorage so the auth client works in
// the browser without crashing before the sign-in HTTP request is made.
const authStorage =
  Platform.OS === 'web'
    ? {
        setItem: (key: string, value: string) => {
          if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
        },
        getItem: (key: string): string | null => {
          if (typeof window !== 'undefined') return window.localStorage.getItem(key);
          return null;
        },
      }
    : {
        setItem: (key: string, value: string) => SecureStore.setItem(key, value),
        getItem: (key: string) => SecureStore.getItem(key),
      };

export const authClient = createAuthClient({
  baseURL: getApiBaseUrl(),
  plugins: [
    expoClient({
      scheme: 'packrat',
      storagePrefix: 'packrat',
      storage: authStorage,
    }),
  ],
});

export type BetterAuthSession = typeof authClient.$Infer.Session;

export async function getActiveToken(): Promise<string | null> {
  const { data } = await authClient.getSession();
  return data?.session?.token ?? null;
}
