/**
 * PackRat API client.
 *
 * Fetch-based wrapper that exposes `.get / .post / .put / .patch / .delete`
 * with automatic auth-token injection and transparent 401 refresh-token flow.
 *
 * All 43+ hook files import the default export (`apiClient`) which preserves
 * the same surface the previous axios instance had.
 */

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
// Shared auth-token plumbing
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
// Fetch wrapper with auth + 401 retry
// ---------------------------------------------------------------------------

// biome-ignore lint/suspicious/noExplicitAny: params may contain nested objects (e.g. sort)
type Params = Record<string, any>;
type HeaderMap = Record<string, string>;

type RequestConfig = {
  params?: Params;
  headers?: HeaderMap;
  timeout?: number;
  signal?: AbortSignal;
  responseType?: 'json' | 'text' | 'blob';
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
  public response?: { data: T; status: number; headers: HeaderMap };
  public config: RequestConfig;
  public status?: number;

  constructor(message: string, status?: number, data?: T, config: RequestConfig = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.config = config;
    if (status !== undefined) {
      this.response = { data: data as T, status, headers: {} };
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

function headersToObject(headers: globalThis.Headers): HeaderMap {
  const obj: HeaderMap = {};
  for (const [key, value] of headers.entries()) {
    obj[key] = value;
  }
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

  const headers: HeaderMap = {
    Accept: 'application/json',
    ...config.headers,
  };

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

  // Handle 401 by refreshing the token once and retrying. Use strict
  // equality against the path (not endsWith) per #2169 so a future route
  // like /foo/api/auth/refresh cannot silently disable the retry guard.
  if (response.status === 401 && !config._retry && path !== '/api/auth/refresh') {
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

/**
 * Legacy fetch wrapper scheduled for removal once #2171 migrates all
 * callsites to the typed Treaty client. The `any` default on each method
 * matches the axios-shape used by existing callers; tightening to
 * `unknown` here cascades into 40+ unrelated hook files and is work
 * that belongs to the Treaty migration itself, not this PR.
 */
// biome-ignore-start lint/suspicious/noExplicitAny: legacy axios-shape — removed with #2171
export const apiClient = {
  get: <T = any>(path: string, config?: RequestConfig) =>
    execute<T>('GET', path, undefined, config),
  post: <T = any>(path: string, body?: unknown, config?: RequestConfig) =>
    execute<T>('POST', path, body, config),
  put: <T = any>(path: string, body?: unknown, config?: RequestConfig) =>
    execute<T>('PUT', path, body, config),
  patch: <T = any>(path: string, body?: unknown, config?: RequestConfig) =>
    execute<T>('PATCH', path, body, config),
  delete: <T = any>(path: string, config?: RequestConfig) =>
    execute<T>('DELETE', path, undefined, config),
};
// biome-ignore-end lint/suspicious/noExplicitAny: legacy axios-shape — removed with #2171

export type ApiClient = typeof apiClient;

// Default export — all 43+ hooks import this as `axiosInstance`
export default apiClient;

/**
 * Type guard for API errors thrown by the fetch wrapper.
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
