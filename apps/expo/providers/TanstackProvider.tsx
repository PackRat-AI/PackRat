import * as Sentry from '@sentry/react-native';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

// Create a client
export const queryClient = new QueryClient({
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

export function TanstackProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
