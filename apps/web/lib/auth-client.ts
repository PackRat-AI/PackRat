'use client';

import { nextCookies } from 'better-auth/next-js';
import { createAuthClient } from 'better-auth/react';
import { getApiBaseUrl } from 'web-app/lib/getApiBaseUrl';

export const authClient = createAuthClient({
  baseURL: getApiBaseUrl(),
  plugins: [nextCookies()],
});
