import { treaty } from '@elysiajs/eden';
import type { App } from '@packrat/api';
import { isObject, isString } from '@packrat/guards';

/**
 * Auth integration hooks. Session state (token storage, refresh dedup,
 * reauth signaling) is NOT owned by this package — it belongs to the
 * consumer app so different platforms (Expo, web, landing) can use their
 * own persistence.
 */
export type AuthHooks = {
  /** Return a bearer access token or `null` when unauthenticated. */
  getAccessToken: () => Promise<string | null> | string | null;
  /** Return the refresh token or `null` when no session exists. */
  getRefreshToken: () => Promise<string | null> | string | null;
  /** Persist a newly-issued access token after a successful refresh. */
  onAccessTokenRefreshed: (accessToken: string) => Promise<void> | void;
  /** Persist a newly-issued refresh token after a successful refresh. */
  onRefreshTokenRefreshed?: (refreshToken: string) => Promise<void> | void;
  /** Called when refresh fails and the user must log in again. */
  onNeedsReauth: () => Promise<void> | void;
};

export type ApiClientConfig = {
  baseUrl: string;
  auth: AuthHooks;
  /** Optional fetch override (e.g. for tests or custom runtimes). */
  fetcher?: typeof fetch;
};

/**
 * Construct a typed Treaty client for the PackRat API. Handles bearer-token
 * injection and transparent refresh on 401 (for every path except the
 * refresh endpoint itself).
 */
export function createApiClient(config: ApiClientConfig) {
  const baseFetcher = config.fetcher ?? fetch;
  let pendingRefresh: Promise<string | null> | null = null;

  async function refreshAccessToken(): Promise<string | null> {
    if (pendingRefresh) return pendingRefresh;
    pendingRefresh = (async () => {
      try {
        const refreshToken = await config.auth.getRefreshToken();
        if (!refreshToken) {
          await config.auth.onNeedsReauth();
          return null;
        }
        const response = await baseFetcher(`${config.baseUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        const data = (await response.json().catch(() => null)) as {
          success?: boolean;
          accessToken?: string;
          refreshToken?: string;
        } | null;

        if (response.ok && data?.success && data.accessToken) {
          await config.auth.onAccessTokenRefreshed(data.accessToken);
          if (data.refreshToken) {
            await config.auth.onRefreshTokenRefreshed?.(data.refreshToken);
          }
          return data.accessToken;
        }

        await config.auth.onNeedsReauth();
        return null;
      } catch {
        await config.auth.onNeedsReauth();
        return null;
      } finally {
        pendingRefresh = null;
      }
    })();
    return pendingRefresh;
  }

  /**
   * Fetch wrapper that attaches the current access token and transparently
   * refreshes + retries once on a 401 response (unless the 401 came from the
   * refresh endpoint itself, in which case the user must re-auth).
   */
  const authFetcher = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = isString(input) ? input : input instanceof URL ? input.toString() : input.url;
    let pathname = '';
    try {
      pathname = new URL(url, config.baseUrl).pathname;
    } catch {
      pathname = '';
    }
    const isRefreshPath = pathname === '/api/auth/refresh';

    const buildRequest = (
      token: string | null,
      base: RequestInfo | URL,
    ): [RequestInfo | URL, RequestInit | undefined] => {
      if (!token) return [base, init];
      const headers = new Headers(init?.headers ?? {});
      headers.set('Authorization', `Bearer ${token}`);
      return [base, { ...init, headers }];
    };

    // Pre-clone a Request before any reads so the retry has an intact body.
    // For URL/string inputs (the common Eden Treaty case) this is a no-op.
    const firstBase = input instanceof Request ? input.clone() : input;

    const firstToken = isRefreshPath ? null : await config.auth.getAccessToken();
    const [firstInput, firstInit] = buildRequest(firstToken, firstBase);
    const response = await baseFetcher(firstInput, firstInit);

    if (response.status !== 401 || isRefreshPath) return response;

    const newToken = await refreshAccessToken();
    if (!newToken) return response;

    // `input` (the original) was never passed to fetch, so its body is still intact.
    const [retryInput, retryInit] = buildRequest(newToken, input);
    return baseFetcher(retryInput, retryInit);
  };

  // Pre-drill into the `/api` prefix so consumers write `client.catalog.get()`
  // rather than `client.api.catalog.get()`. The server mounts every route
  // group under the `routes` plugin which itself has `prefix: '/api'`, so the
  // `.api` level of the Treaty surface is pure noise.
  // Treaty only uses the callable form of `fetch`; the globalThis.fetch type
  // includes a `preconnect` method our wrapper doesn't need. Cast through
  // unknown to bridge the two shapes without pulling preconnect into scope.
  return treaty<App>(config.baseUrl, { fetcher: authFetcher as unknown as typeof fetch }).api;
}

export type ApiClient = ReturnType<typeof createApiClient>;

/**
 * Extract the unwrapped response data type from a Treaty endpoint call.
 *
 * Example:
 * ```ts
 * type Pack = ApiData<ReturnType<ApiClient['packs']['get']>>;
 * ```
 */
export type ApiData<R> = R extends Promise<{ data: infer D | null }> ? NonNullable<D> : never;

/**
 * Extract the request body type from a Treaty mutation method.
 *
 * Example:
 * ```ts
 * type CreatePackBody = ApiBody<ApiClient['packs']['post']>;
 * ```
 */
export type ApiBody<F extends (...args: never[]) => unknown> = Parameters<F>[0];

export type { App };

// ── Generic HTTP client (for MCP and non-Treaty consumers) ────────────────────

export interface ApiErrorOptions {
  status: number;
  body: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, options: ApiErrorOptions) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.body = options.body;
  }
}

export type QueryParams = Record<string, string | number | boolean | undefined>;

export class PackRatApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly getAuthToken: () => string,
  ) {}

  private get headers(): Record<string, string> {
    const token = this.getAuthToken();
    const base: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (token) base.Authorization = `Bearer ${token}`;
    return base;
  }

  async get<T = unknown>(path: string, params?: QueryParams): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }
    const response = await fetch(url.toString(), { method: 'GET', headers: this.headers });
    return this.handleResponse<T>(response);
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  async put<T = unknown>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: this.headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  async patch<T = unknown>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'PATCH',
      headers: this.headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  async delete<T = unknown>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: this.headers,
    });
    return this.handleResponse<T>(response);
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const errorMessage =
        isObject(body) && 'error' in body
          ? String((body as Record<string, unknown>).error)
          : `HTTP ${response.status}`;
      throw new ApiError(errorMessage, { status: response.status, body });
    }
    return body as T;
  }
}

export function createPackRatClient(baseUrl: string, getAuthToken: () => string): PackRatApiClient {
  return new PackRatApiClient(baseUrl, getAuthToken);
}

// ── MCP tool result helpers ───────────────────────────────────────────────────

export function ok(data: unknown): { content: [{ type: 'text'; text: string }] } {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

export function err(error: unknown): { content: [{ type: 'text'; text: string }]; isError: true } {
  const message =
    error instanceof ApiError
      ? `API Error (${error.status}): ${error.message}`
      : error instanceof Error
        ? error.message
        : String(error);
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true,
  };
}
