import * as Sentry from '@sentry/react-native';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type React from 'react';

// 401 = handled by auth refresh cycle; 429 = transient rate-limit; 404 = intentional not-found.
// Capturing these would flood Sentry with recoverable, non-actionable noise.
function shouldCapture(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  return status !== 401 && status !== 429 && status !== 404;
}

// Create a client
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError(error, query) {
      if (!shouldCapture(error)) return;
      Sentry.captureException(error, {
        tags: { feature: 'reactQuery', action: 'query' },
        extra: { queryKey: query.queryKey },
      });
    },
  }),
  mutationCache: new MutationCache({
    onError(error) {
      if (!shouldCapture(error)) return;
      Sentry.captureException(error, {
        tags: { feature: 'reactQuery', action: 'mutation' },
      });
    },
  }),
});

export function TanstackProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
