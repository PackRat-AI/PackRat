import { clientEnvs } from '@packrat/env/expo-client';
import { store } from 'expo-app/atoms/store';
import {
  needsReauthAtom,
  refreshTokenAtom,
  tokenAtom,
} from 'expo-app/features/auth/atoms/authAtoms';

/**
 * Web version of the API client.
 * Uses fetch + localStorage instead of expo-sqlite/kv-store.
 * Metro automatically picks this file over client.ts for web builds.
 */

export const API_URL = clientEnvs.EXPO_PUBLIC_API_URL;

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

function readLocalToken(key: string): string | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  // atomWithStorage JSON-serializes values; read back either format safely.
  try {
    return JSON.parse(raw) ?? null;
  } catch {
    return raw;
  }
}

async function getToken(): Promise<string | null> {
  return readLocalToken('access_token');
}

async function refreshTokens(): Promise<string | null> {
  if (isRefreshing && refreshPromise) return refreshPromise;
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = readLocalToken('refresh_token');
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const data = await res.json();
      if (res.ok && data.accessToken) {
        localStorage.setItem('access_token', data.accessToken);
        localStorage.setItem('refresh_token', data.refreshToken);
        await store.set(tokenAtom, data.accessToken);
        await store.set(refreshTokenAtom, data.refreshToken);
        return data.accessToken;
      }
      store.set(needsReauthAtom, true);
      return null;
    } catch {
      store.set(needsReauthAtom, true);
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

// biome-ignore lint/complexity/useMaxParams: internal helper needs method, path, body, retry
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  retry = true,
): Promise<{ data: T; status: number }> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry) {
    const newToken = await refreshTokens();
    if (newToken) return request<T>(method, path, body, false);
  }

  const data = await res.json().catch(() => null);
  return { data: data as T, status: res.status };
}

const axiosInstance = {
  get: <T = unknown>(path: string) => request<T>('GET', path),
  post: <T = unknown>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T = unknown>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T = unknown>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T = unknown>(path: string) => request<T>('DELETE', path),
};

export const handleApiError = (error: unknown): { message: string; status?: number } => {
  if (error instanceof Error) return { message: error.message };
  return { message: 'An unknown error occurred' };
};

export default axiosInstance;
