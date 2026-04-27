import { treaty } from '@elysiajs/eden';
import type { App } from '@packrat/api-client';
import { clearToken, getAuthHeader } from './auth';
import { adminEnv } from './env';

const API_BASE = adminEnv.NEXT_PUBLIC_API_URL;

// safe-cast: Eden Treaty fetcher expects typeof fetch; CF Workers adds preconnect
// which is never called by Eden — only the (input, init) signature is used.
const adminFetcher: typeof fetch = Object.assign(
  (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const authHeaders = getAuthHeader();
    const existing = init?.headers ? Object.fromEntries(new Headers(init.headers)) : {};
    const response = fetch(input, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...authHeaders, ...existing },
    });
    response.then((r) => {
      if (r.status === 401) {
        clearToken();
        if (typeof window !== 'undefined') window.location.replace('/login');
      }
    });
    return response;
  },
  fetch,
);

export const adminClient = treaty<App>(API_BASE, { fetcher: adminFetcher }).api.admin;
