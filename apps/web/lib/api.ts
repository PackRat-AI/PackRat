import { createApiClient } from '@packrat/api-client';
import { webEnv } from '@packrat/env/web';
import { authClient } from 'web-app/lib/auth-client';

export const apiClient = createApiClient({
  baseUrl: webEnv.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787',
  auth: {
    getAccessToken: async () => {
      const { data } = await authClient.getSession();
      return data?.session?.token ?? null;
    },
    getRefreshToken: async () => null,
    onAccessTokenRefreshed: () => {},
    onNeedsReauth: () => {
      if (typeof window !== 'undefined') {
        window.location.href = '/auth';
      }
    },
  },
});

export type PackRatWebApi = typeof apiClient;
