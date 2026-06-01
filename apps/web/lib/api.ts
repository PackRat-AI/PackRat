import { createApiClient } from '@packrat/api-client';
import { authClient } from 'web-app/lib/auth-client';
import { getApiBaseUrl } from 'web-app/lib/getApiBaseUrl';

export const apiClient = createApiClient({
  baseUrl: getApiBaseUrl(),
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
