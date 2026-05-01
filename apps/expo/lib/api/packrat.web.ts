import { createApiClient } from '@packrat/api-client';
import { clientEnvs } from '@packrat/env/expo-client';
import { store } from 'expo-app/atoms/store';
import {
  needsReauthAtom,
  refreshTokenAtom,
  tokenAtom,
} from 'expo-app/features/auth/atoms/authAtoms';

function readLocalToken(key: string): string | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  // atomWithStorage JSON-serializes values; handle both raw and JSON-quoted.
  try {
    return JSON.parse(raw) ?? null;
  } catch {
    return raw;
  }
}

/**
 * Web version of the PackRat API client.
 * Uses localStorage instead of expo-sqlite/kv-store (native only).
 * Also updates localStorage directly on token refresh so client.web.ts stays in sync.
 */
export const apiClient = createApiClient({
  baseUrl: clientEnvs.EXPO_PUBLIC_API_URL,
  auth: {
    getAccessToken: () => Promise.resolve(readLocalToken('access_token')),
    getRefreshToken: () => Promise.resolve(readLocalToken('refresh_token')),
    onAccessTokenRefreshed: async (accessToken) => {
      localStorage.setItem('access_token', accessToken);
      await store.set(tokenAtom, accessToken);
    },
    onRefreshTokenRefreshed: async (refreshToken) => {
      localStorage.setItem('refresh_token', refreshToken);
      await store.set(refreshTokenAtom, refreshToken);
    },
    onNeedsReauth: () => {
      store.set(needsReauthAtom, true);
    },
  },
});

export type PackRatApi = typeof apiClient;
