import { clientEnvs } from '@packrat/env/expo-client';
import { store } from 'expo-app/atoms/store';
import {
  needsReauthAtom,
  refreshTokenAtom,
  tokenAtom,
} from 'expo-app/features/auth/atoms/authAtoms';
import Storage from 'expo-sqlite/kv-store';

type FetchLike = typeof fetch;

type QueuedRequest = {
  input: RequestInfo | URL;
  init?: RequestInit;
  resolve: (value: Response | PromiseLike<Response>) => void;
  reject: (reason?: unknown) => void;
};

const defaultBaseUrl = clientEnvs.EXPO_PUBLIC_API_URL;

let isRefreshing = false;
let failedQueue: QueuedRequest[] = [];

const cloneInit = (init?: RequestInit): RequestInit | undefined => {
  if (!init) {
    return undefined;
  }

  return {
    ...init,
    headers: init.headers ? new Headers(init.headers) : undefined,
  };
};

const withAuthHeaders = async (
  init?: RequestInit,
  tokenOverride?: string | null,
): Promise<RequestInit> => {
  const headers = new Headers(init?.headers);

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  const token = tokenOverride ?? (await Storage.getItem('access_token'));
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return {
    ...init,
    headers,
  };
};

const processQueue = async (
  { error, token }: { error: Error | null; token: string | null },
  fetchImpl: FetchLike,
) => {
  const pending = failedQueue;
  failedQueue = [];

  for (const request of pending) {
    if (error) {
      request.reject(error);
      continue;
    }

    try {
      const retryHeaders = new Headers(request.init?.headers);
      retryHeaders.set('x-packrat-rpc-retry', 'true');
      const retryInit = await withAuthHeaders({ ...request.init, headers: retryHeaders }, token);
      request.resolve(fetchImpl(request.input, retryInit));
    } catch (retryError) {
      request.reject(retryError);
    }
  }
};

const refreshAccessToken = async (fetchImpl: FetchLike, baseUrl: string) => {
  const refreshToken = await Storage.getItem('refresh_token');

  const response = await fetchImpl(`${baseUrl}/api/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  const data = (await response.json()) as {
    success?: boolean;
    accessToken?: string;
    refreshToken?: string;
  };

  if (!response.ok || !data.success || !data.accessToken || !data.refreshToken) {
    throw new Error('Token refresh failed');
  }

  await store.set(tokenAtom, data.accessToken);
  await store.set(refreshTokenAtom, data.refreshToken);

  return data.accessToken;
};

export const createRpcFetch = (options: { baseUrl?: string; fetchImpl?: FetchLike } = {}) => {
  const baseUrl = options.baseUrl ?? defaultBaseUrl;
  const fetchImpl = options.fetchImpl ?? fetch;

  const rpcFetch = Object.assign(
    async (input: Parameters<FetchLike>[0], init?: Parameters<FetchLike>[1]) => {
      const authedInit = await withAuthHeaders(init);
      const response = await fetchImpl(input, authedInit);

      if (response.status !== 401) {
        return response;
      }

      const retried = new Headers(init?.headers).get('x-packrat-rpc-retry');
      if (retried === 'true') {
        return response;
      }

      if (isRefreshing) {
        return await new Promise<Response>((resolve, reject) => {
          failedQueue.push({
            input,
            init: cloneInit(init),
            resolve,
            reject,
          });
        });
      }

      isRefreshing = true;

      try {
        const nextToken = await refreshAccessToken(fetchImpl, baseUrl);
        await processQueue({ error: null, token: nextToken }, fetchImpl);

        const retryHeaders = new Headers(init?.headers);
        retryHeaders.set('x-packrat-rpc-retry', 'true');

        return await fetchImpl(
          input,
          await withAuthHeaders(
            {
              ...cloneInit(init),
              headers: retryHeaders,
            },
            nextToken,
          ),
        );
      } catch (error) {
        await store.set(needsReauthAtom, true);
        await processQueue({ error: error as Error, token: null }, fetchImpl);
        throw error;
      } finally {
        isRefreshing = false;
      }
    },
    fetchImpl,
  ) satisfies FetchLike;

  return rpcFetch;
};
