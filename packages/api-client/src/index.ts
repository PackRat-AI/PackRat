import { treaty } from '@elysiajs/eden';
import type { App } from '@packrat/api';

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
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    let pathname = '';
    try {
      pathname = new URL(url, config.baseUrl).pathname;
    } catch {
      pathname = '';
    }
    const isRefreshPath = pathname === '/api/auth/refresh';

    const attach = async (token: string | null): Promise<RequestInit | undefined> => {
      if (!token) return init;
      const headers = new Headers(init?.headers ?? {});
      headers.set('Authorization', `Bearer ${token}`);
      return { ...init, headers };
    };

    const firstToken = isRefreshPath ? null : await config.auth.getAccessToken();
    const firstInit = await attach(firstToken);
    const response = await baseFetcher(input, firstInit);

    if (response.status !== 401 || isRefreshPath) return response;

    const newToken = await refreshAccessToken();
    if (!newToken) return response;

    const retryInit = await attach(newToken);
    return baseFetcher(input, retryInit);
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

export type { App };
