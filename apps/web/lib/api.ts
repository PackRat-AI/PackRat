import { createApiClient } from '@packrat/api-client';
import Cookies from 'js-cookie';

export const apiClient = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787',
  auth: {
    getAccessToken: () => Cookies.get('access_token') ?? null,
    getRefreshToken: () => Cookies.get('refresh_token') ?? null,
    onAccessTokenRefreshed: (token) =>
      void Cookies.set('access_token', token, { expires: 1, sameSite: 'strict' }),
    onRefreshTokenRefreshed: (token) =>
      void Cookies.set('refresh_token', token, { expires: 30, sameSite: 'strict' }),
    onNeedsReauth: () => {
      if (typeof window !== 'undefined') {
        window.location.href = '/auth';
      }
    },
  },
});

export type PackRatWebApi = typeof apiClient;
