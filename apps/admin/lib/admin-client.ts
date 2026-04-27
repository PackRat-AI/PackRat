import { treaty } from '@elysiajs/eden';
import type { App } from '@packrat/api-client';
import { clearToken, getAuthHeader } from './auth';
import { getCFAccessJWT } from './cfAccess';
import { adminEnv } from './env';

const API_BASE = adminEnv.NEXT_PUBLIC_API_URL;

async function buildAuthHeaders(): Promise<Record<string, string>> {
  const cfJwt = await getCFAccessJWT();
  if (cfJwt) return { 'CF-Access-JWT-Assertion': cfJwt };
  return getAuthHeader();
}

// safe-cast: Eden Treaty fetcher expects typeof fetch; CF Workers adds preconnect
// which is never called by Eden — only the (input, init) signature is used.
const adminFetcher: typeof fetch = Object.assign(
  async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const authHeaders = await buildAuthHeaders();
    const existing = init?.headers ? Object.fromEntries(new Headers(init.headers)) : {};
    const response = await fetch(input, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...authHeaders, ...existing },
    });
    if (response.status === 401) {
      clearToken();
      if (typeof window !== 'undefined') window.location.replace('/login');
    }
    return response;
  },
  fetch,
);

export const adminClient = treaty<App>(API_BASE, { fetcher: adminFetcher }).api.admin;
