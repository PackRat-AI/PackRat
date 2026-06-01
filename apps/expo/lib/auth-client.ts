import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import { getApiBaseUrl } from 'expo-app/lib/api/getBaseUrl';
import * as SecureStore from 'expo-secure-store';

export const authClient = createAuthClient({
  baseURL: getApiBaseUrl(),
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
