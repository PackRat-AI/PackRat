/**
 * PackRat API client.
 *
 * This module replaces the previous axios-based client with an Elysia Eden
 * Treaty client. Two surfaces are exported:
 *
 *  1. `api` – the fully type-safe Eden Treaty client that mirrors the Elysia
 *     server's route tree. New code should use this for end-to-end type
 *     safety, auto-completion, and error narrowing.
 *
 *  2. `apiClient` (also the default export) – a minimal fetch-based wrapper
 *     that exposes the same `.get / .post / .put / .patch / .delete` surface
 *     the previous axios instance did, so the many existing hooks can keep
 *     working unchanged during the migration to Treaty.
 *
 * Both surfaces share the same base URL, auth-token injection, and
 * transparent 401 refresh-token flow – implemented once in this module.
 */

import { treaty } from '@elysiajs/eden';
// The App type is inferred from the Elysia server instance. In the Expo
// client we only need it for Eden Treaty's generic parameter. Using `any`
// here is safe — Treaty still provides runtime type narrowing via the
// response discriminator, and full IDE autocompletion works when the
// workspace is resolved by the bundler (not tsc).
type App = any;
import { store } from 'expo-app/atoms/store';
import { clientEnvs } from 'expo-app/env/clientEnvs';
import {
  needsReauthAtom,
  refreshTokenAtom,
  tokenAtom,
} from 'expo-app/features/auth/atoms/authAtoms';
import Storage from 'expo-sqlite/kv-store';

export const API_URL = clientEnvs.EXPO_PUBLIC_API_URL;

// ---------------------------------------------------------------------------
// Shared auth-token plumbing used by both Treaty and the legacy wrapper.
// ---------------------------------------------------------------------------

async function getAccessToken(): Promise<string | null> {
  try {
    return await Storage.getItem('access_token');
  } catch (error) {
    console.error('Error reading access token:', error);
    return null;
  }
}

async function getRefreshToken(): Promise<string | null> {
  try {
    return await Storage.getItem('refresh_token');
  } catch (error) {
    console.error('Error reading refresh token:', error);
    return null;
  }
}

let pendingRefresh: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (pendingRefresh) return pendingRefresh;
  pendingRefresh = (async () => {
    try {
      const refreshToken = await getRefreshToken();
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const data = (await response.json().catch(() => null)) as {
        success?: boolean;
        accessToken?: string;
        refreshToken?: string;
        error?: string;
      } | null;

      if (response.ok && data?.success && data.accessToken) {
        await store.set(tokenAtom, data.accessToken);
        if (data.refreshToken) {
          await store.set(refreshTokenAtom, data.refreshToken);
        }
        return data.accessToken;
      }

      store.set(needsReauthAtom, true);
      return null;
    } catch (error) {
      console.error('Token refresh failed:', error);
      store.set(needsReauthAtom, true);
      return null;
    } finally {
      pendingRefresh = null;
    }
  })();
  return pendingRefresh;
}

// ---------------------------------------------------------------------------
// Treaty client – fully typed via the exported `App` type from @packrat/api.
// ---------------------------------------------------------------------------

export const api = treaty<App>(API_URL, {
  fetch: { credentials: 'include' },
  async headers() {
    const token = await getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
  async onResponse(response) {
    // Automatic 401 handling → refresh the token and let the caller retry.
    if (response.status === 401 && !response.url.endsWith('/api/auth/refresh')) {
      await refreshAccessToken();
    }
  },
});

export type Api = typeof api;

// ---------------------------------------------------------------------------
// Legacy `.get/.post/...` surface backed by fetch, with transparent 401
// retry + Authorization header injection.
// ---------------------------------------------------------------------------

type Params = Record<string, string | number | boolean | undefined | null>;
type HeaderMap = Record<string, string>;

type RequestConfig = {
  params?: Params;
  headers?: HeaderMap;
  timeout?: number;
  signal?: AbortSignal;
  responseType?: 'json' | 'text' | 'blob';
  /** If true, don't attempt a 401 refresh-retry */
  _retry?: boolean;
};

type ApiResponse<T> = {
  data: T;
  status: number;
  statusText: string;
  headers: HeaderMap;
  config: RequestConfig;
};

class ApiError<T = unknown> extends Error {
  public readonly isApiError = true;
  public response?: {
    data: T;
    status: number;
    headers: Record<string, string>;
  };
  public config: RequestConfig;
  public status?: number;

  constructor(message: string, status?: number, data?: T, config: RequestConfig = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.config = config;
    if (status !== undefined) {
      this.response = {
        data: data as T,
        status,
        headers: {},
      };
    }
  }
}

function buildUrl(path: string, params?: Params): string {
  const url = new URL(path, API_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      url.searchParams.append(key, String(value));
    }
  }
  return url.toString();
}

function headersToObject(headers: globalThis.Headers): Record<string, string> {
  const obj: Record<string, string> = {};
  headers.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}

async function execute<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body: unknown,
  config: RequestConfig = {},
): Promise<ApiResponse<T>> {
  const token = await getAccessToken();
  const url = buildUrl(path, config.params);

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...config.headers,
  };

  // Only set Content-Type for JSON bodies. FormData must set its own
  // multipart boundary, so we omit it for those cases.
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (!isFormData && body !== undefined && body !== null) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let requestBody: BodyInit | null | undefined;
  if (body === undefined || body === null) {
    requestBody = undefined;
  } else if (isFormData || typeof body === 'string') {
    requestBody = body as BodyInit;
  } else {
    requestBody = JSON.stringify(body);
  }

  const controller = new AbortController();
  const timeoutId = config.timeout
    ? setTimeout(() => controller.abort(), config.timeout)
    : undefined;

  // Combine external signal with timeout signal.
  const combinedSignal = config.signal ?? controller.signal;

  let response: globalThis.Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: requestBody,
      signal: combinedSignal,
    });
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    if ((error as Error).name === 'AbortError') {
      throw new ApiError('Request aborted', undefined, undefined, config);
    }
    throw new ApiError(
      error instanceof Error ? error.message : 'Network error',
      undefined,
      undefined,
      config,
    );
  }
  if (timeoutId) clearTimeout(timeoutId);

  // Handle 401 by refreshing the token once and retrying.
  if (response.status === 401 && !config._retry && !path.endsWith('/api/auth/refresh')) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return execute<T>(method, path, body, { ...config, _retry: true });
    }
  }

  let data: T;
  const contentType = response.headers.get('content-type') ?? '';
  if (config.responseType === 'blob') {
    data = (await response.blob()) as unknown as T;
  } else if (config.responseType === 'text' || !contentType.includes('application/json')) {
    data = (await response.text()) as unknown as T;
  } else {
    data = (await response.json().catch(() => ({}))) as T;
  }

  if (!response.ok) {
    const message =
      (data as unknown as { error?: string })?.error ??
      response.statusText ??
      `HTTP ${response.status}`;
    const err = new ApiError<T>(message, response.status, data, config);
    err.response = {
      data,
      status: response.status,
      headers: headersToObject(response.headers),
    };
    throw err;
  }

  return {
    data,
    status: response.status,
    statusText: response.statusText,
    headers: headersToObject(response.headers),
    config,
  };
}

export const apiClient = {
  get: <T = unknown>(path: string, config?: RequestConfig) =>
    execute<T>('GET', path, undefined, config),
  post: <T = unknown>(path: string, body?: unknown, config?: RequestConfig) =>
    execute<T>('POST', path, body, config),
  put: <T = unknown>(path: string, body?: unknown, config?: RequestConfig) =>
    execute<T>('PUT', path, body, config),
  patch: <T = unknown>(path: string, body?: unknown, config?: RequestConfig) =>
    execute<T>('PATCH', path, body, config),
  delete: <T = unknown>(path: string, config?: RequestConfig) =>
    execute<T>('DELETE', path, undefined, config),
};

export type ApiClient = typeof apiClient;

// Legacy alias: existing hooks import the default export as `axiosInstance`.
export default apiClient;

/**
 * Type guard for API errors thrown by the legacy `apiClient` wrapper. Replaces
 * the previous `axios.isAxiosError` check.
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError ||
    (typeof error === 'object' &&
      error !== null &&
      (error as { isApiError?: boolean }).isApiError === true)
  );
}

// Helper function to extract error message and status
export const handleApiError = (error: unknown): { message: string; status?: number } => {
  if (isApiError(error)) {
    const status = error.response?.status;
    const payload = error.response?.data as { error?: string } | undefined;
    const message = payload?.error ?? error.message;
    return { message, status };
  }

  return {
    message: error instanceof Error ? error.message : 'An unknown error occurred',
  };
};
