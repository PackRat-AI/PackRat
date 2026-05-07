'use client';

import { createApiClient } from '@packrat/api-client';
import {
  clearTokens,
  clearUser,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from 'trails-app/lib/auth';

// Routes through the same-origin CF Worker proxy (/api/*) so rate limiting applies.
export const apiClient = createApiClient({
  baseUrl: typeof window !== 'undefined' ? window.location.origin : '',
  auth: {
    getAccessToken,
    getRefreshToken,
    onAccessTokenRefreshed: (token) => {
      const refresh = getRefreshToken();
      if (refresh) setTokens(token, refresh);
    },
    onRefreshTokenRefreshed: (token) => {
      const access = getAccessToken();
      if (access) setTokens(access, token);
    },
    onNeedsReauth: () => {
      clearTokens();
      clearUser();
    },
  },
});

export class AuthExpiredError extends Error {
  constructor() {
    super('Session expired. Please log in again.');
    this.name = 'AuthExpiredError';
  }
}
