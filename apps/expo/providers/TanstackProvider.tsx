import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { FEATURE_ACCESS_QUERY_KEY } from 'expo-app/features/purchases/hooks/useFeatureAccess';
import type React from 'react';

// 401 = handled by auth refresh cycle; 429 = transient rate-limit; 404 = intentional not-found.
// Capturing these would flood Sentry with recoverable, non-actionable noise.
function getHttpMeta(error: unknown): {
  capture: boolean;
  httpStatus?: number;
  errorCode?: string;
} {
  const e = error as { status?: number; code?: string; errorCode?: string };
  const httpStatus = e?.status;
  if (httpStatus === 401 || httpStatus === 429 || httpStatus === 404) return { capture: false };
  return { capture: true, httpStatus, errorCode: e?.errorCode ?? e?.code };
}

// Queries that must survive an app restart / offline cold start. Kept to an
// explicit allowlist so we persist small, safe config — not large or sensitive
// payloads. `feature-access` config powers the early-access gate: persisting it
// lets the gate resolve which features are gated without a network round-trip.
const PERSISTED_QUERY_KEYS: readonly (readonly unknown[])[] = [FEATURE_ACCESS_QUERY_KEY];

function isPersistedQuery(queryKey: readonly unknown[]): boolean {
  return PERSISTED_QUERY_KEYS.some(
    (key) => key.length <= queryKey.length && key.every((part, i) => part === queryKey[i]),
  );
}

// Create a client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Persisted queries must not be garbage-collected before restore, so keep
      // cached data for 24h. Non-persisted queries are unaffected at runtime.
      gcTime: 1000 * 60 * 60 * 24,
    },
  },
  queryCache: new QueryCache({
    onError(error, query) {
      const { capture, httpStatus, errorCode } = getHttpMeta(error);
      if (!capture) return;
      Sentry.captureException(error, {
        tags: { feature: 'reactQuery', action: 'query' },
        extra: { queryKey: query.queryKey, httpStatus, errorCode },
      });
    },
  }),
  mutationCache: new MutationCache({
    onError(error) {
      const { capture, httpStatus, errorCode } = getHttpMeta(error);
      if (!capture) return;
      Sentry.captureException(error, {
        tags: { feature: 'reactQuery', action: 'mutation' },
        extra: { httpStatus, errorCode },
      });
    },
  }),
});

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'packrat.reactQueryCache.v1',
});

export function TanstackProvider({ children }: { children: React.ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24 * 7, // discard restored cache older than 7 days
        dehydrateOptions: {
          // Only persist our allowlisted query keys, AND only a successful
          // result — never a pending/errored snapshot that would restore as
          // stale-but-"resolved" offline. (This mirrors React Query's default
          // shouldDehydrateQuery success check, inlined to avoid a duplicate
          // query-core type mismatch across the persist-client package.)
          shouldDehydrateQuery: (query) =>
            isPersistedQuery(query.queryKey) && query.state.status === 'success',
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
