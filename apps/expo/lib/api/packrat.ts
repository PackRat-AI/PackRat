import { createApiClient } from '@packrat/api-client';
import { clientEnvs } from '@packrat/env/expo-client';
import { store } from 'expo-app/atoms/store';
import { needsReauthAtom } from 'expo-app/features/auth/atoms/authAtoms';
import { authClient } from 'expo-app/lib/auth-client';

export const apiClient = createApiClient({
  baseUrl: clientEnvs.EXPO_PUBLIC_API_URL,
  auth: {
    getAccessToken: async () => {
      const { data } = await authClient.getSession();
      return data?.session?.token ?? null;
    },
    // Better Auth manages session renewal internally — no separate refresh token flow.
    getRefreshToken: () => null,
    onAccessTokenRefreshed: () => {},
    onNeedsReauth: () => {
      store.set(needsReauthAtom, true);
    },
  },
});

export type PackRatApi = typeof apiClient;
