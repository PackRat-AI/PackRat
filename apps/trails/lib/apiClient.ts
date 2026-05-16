'use client';

import { createApiClient } from '@packrat/api-client';
import { trailsAuthClient } from 'trails-app/lib/auth-client';
import { trailsEnv } from 'trails-app/lib/env';

export class AuthExpiredError extends Error {
  constructor() {
    super('Session expired. Please log in again.');
    this.name = 'AuthExpiredError';
  }
}

export const apiClient = createApiClient({
  baseUrl: trailsEnv.NEXT_PUBLIC_API_URL,
  auth: {
    getAccessToken: async () => {
      const { data } = await trailsAuthClient.getSession();
      return data?.session?.token ?? null;
    },
    // Better Auth manages session refresh internally via cookies
    getRefreshToken: async () => null,
    onAccessTokenRefreshed: () => {},
    onNeedsReauth: () => {},
  },
});
