'use client';

import { createAuthClient } from 'better-auth/react';
import { trailsEnv } from 'trails-app/lib/env';

export const trailsAuthClient = createAuthClient({
  baseURL: trailsEnv.NEXT_PUBLIC_API_URL,
});
