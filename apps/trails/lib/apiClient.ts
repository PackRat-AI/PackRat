'use client';

import { createApiClient } from '@packrat/api-client';
import {
  clearTokens,
  clearUser,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from 'trails-app/lib/auth';
import { trailsEnv } from 'trails-app/lib/env';

export const apiClient = createApiClient({
  baseUrl: trailsEnv.NEXT_PUBLIC_API_URL,
  auth: {
    getAccessToken,
    getRefreshToken,
    onAccessTokenRefreshed: (token) => {
      const refresh = getRefreshToken();
      if (refresh) setTokens(token, refresh);
      else {
        clearTokens();
        clearUser();
      }
    },
    onRefreshTokenRefreshed: (token) => {
      const access = getAccessToken();
      if (access) setTokens(access, token);
      else {
        clearTokens();
        clearUser();
      }
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
