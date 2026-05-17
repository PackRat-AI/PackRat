'use client';

import { webEnv } from '@packrat/env/web';
import { nextCookies } from 'better-auth/next-js';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: webEnv.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787',
  plugins: [nextCookies()],
});
