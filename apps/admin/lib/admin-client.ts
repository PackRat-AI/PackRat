import { treaty } from '@elysiajs/eden';
import type { App } from '@packrat/api-client';
import { clearToken, getAuthHeader } from './auth';
import { getCFAccessJWT } from './cfAccess';

const API_BASE = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE) {
  throw new Error('NEXT_PUBLIC_API_URL must be set (root .env.local → PUBLIC_API_URL)');
}

async function buildAuthHeaders(): Promise<Record<string, string>> {
  const cfJwt = await getCFAccessJWT();
  if (cfJwt) return { 'CF-Access-JWT-Assertion': cfJwt };
  return getAuthHeader();
}

export const adminClient = treaty<App>(API_BASE, {
  fetcher: async (input, init) => {
    const authHeaders = await buildAuthHeaders();
    const response = await fetch(input, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...(init?.headers as Record<string, string> | undefined),
      },
    });
    if (response.status === 401) {
      clearToken();
      if (typeof window !== 'undefined') window.location.replace('/login');
    }
    return response;
  },
}).api.admin;
