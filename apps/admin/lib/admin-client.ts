import { treaty } from '@elysiajs/eden';
import type { App } from '@packrat/api-client';
import { clearToken, getAuthHeader } from './auth';
import { adminEnv } from './env';

const API_BASE = adminEnv.NEXT_PUBLIC_API_URL;

export const adminClient = treaty<App>(API_BASE, {
  headers() {
    return getAuthHeader();
  },
  onResponse(response) {
    if (response.status === 401) {
      clearToken();
      if (typeof window !== 'undefined') window.location.replace('/login');
    }
    return response;
  },
}).api.admin;
