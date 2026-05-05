import { createApiClient } from '@packrat/api-client';
import { clientEnvs } from '@packrat/env/expo-client';
import { store } from 'expo-app/atoms/store';
import {
  needsReauthAtom,
  refreshTokenAtom,
  tokenAtom,
} from 'expo-app/features/auth/atoms/authAtoms';
import Storage from 'expo-sqlite/kv-store';

/**
 * Typed Treaty-backed PackRat API client for the Expo app.
 *
 * Session state (token persistence, reauth signal) lives here — the
 * `@packrat/api-client` package is transport-only and accepts injected
 * auth hooks so guides and landing can reuse it with their own storage
 * layers.
 *
 * Usage:
 * ```ts
 * import { apiClient } from 'expo-app/lib/api/packrat';
 * const { data, error } = await apiClient.catalog.get({ query: { limit: 10 } });
 * ```
 */
export const apiClient = createApiClient({
  baseUrl: clientEnvs.EXPO_PUBLIC_API_URL,
  auth: {
    getAccessToken: () => Storage.getItem('access_token'),
    getRefreshToken: () => Storage.getItem('refresh_token'),
    onAccessTokenRefreshed: async (accessToken) => {
      await store.set(tokenAtom, accessToken);
    },
    onRefreshTokenRefreshed: async (refreshToken) => {
      await store.set(refreshTokenAtom, refreshToken);
    },
    onNeedsReauth: () => {
      store.set(needsReauthAtom, true);
    },
  },
});

export type PackRatApi = typeof apiClient;
