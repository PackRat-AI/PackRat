import { expoClient } from '@better-auth/expo/client';
import { clientEnvs } from '@packrat/env/expo-client';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-app/lib/secureStore';

export const authClient = createAuthClient({
  baseURL: clientEnvs.EXPO_PUBLIC_API_URL,
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
