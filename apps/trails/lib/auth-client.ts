'use client';

import { nextCookies } from 'better-auth/next-js';
import { createAuthClient } from 'better-auth/react';
import { trailsEnv } from 'trails-app/lib/env';

export const authClient = createAuthClient({
  baseURL: trailsEnv.NEXT_PUBLIC_API_URL,
  plugins: [nextCookies()],
});
