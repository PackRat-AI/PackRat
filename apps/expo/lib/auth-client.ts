import { expoClient } from '@better-auth/expo/client';
import { clientEnvs } from '@packrat/env/expo-client';
import { createAuthClient } from 'better-auth/react';
import { secureStorage } from './secureStorage';

export const authClient = createAuthClient({
  baseURL: clientEnvs.EXPO_PUBLIC_API_URL,
  plugins: [
    expoClient({
      scheme: 'packrat',
      storagePrefix: 'packrat',
      storage: {
        setItem: secureStorage.setItem,
        getItem: secureStorage.getItem,
      },
    }),
  ],
});

export type BetterAuthSession = typeof authClient.$Infer.Session;

export async function getActiveToken(): Promise<string | null> {
  const { data } = await authClient.getSession();
  return data?.session?.token ?? null;
}
