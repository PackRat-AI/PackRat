import { createApiClient } from '@packrat/api-client';
import { needsReauthAtom, refreshTokenAtom, tokenAtom } from '@packrat/app/auth/atoms/authAtoms';
import { isAuthed } from '@packrat/app/auth/store';
import { clientEnvs } from '@packrat/env/expo-client';
import { store } from 'expo-app/atoms/store';
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
      // Guard against re-setting the token after sign-out has cleared it.
      // Without this, a token refresh in-flight during sign-out can call
      // store.set(tokenAtom, accessToken) AFTER setToken(null), keeping the
      // app authenticated and leaving NativeTabs mounted on iOS.
      if (isAuthed.peek()) {
        await store.set(tokenAtom, accessToken);
      }
    },
    onRefreshTokenRefreshed: async (refreshToken) => {
      if (isAuthed.peek()) {
        await store.set(refreshTokenAtom, refreshToken);
      }
    },
    onNeedsReauth: () => {
      // Only signal re-auth when the user is still authenticated. An
      // in-flight request may resolve after sign-out clears the tokens;
      // without this guard, the race would set needsReauthAtom = true
      // AFTER signOut has already reset it to false, showing "Resume
      // Sync" on the auth screen instead of the normal sign-in copy.
      if (isAuthed.peek()) {
        store.set(needsReauthAtom, true);
      }
    },
  },
});

export type PackRatApi = typeof apiClient;
