'use client';
import type { createApiClient } from '@packrat/api-client';
import { createContext, type ReactNode, useContext } from 'react';

type ApiClient = ReturnType<typeof createApiClient>;
const ApiClientContext = createContext<ApiClient | null>(null);

export function ApiClientProvider({
  client,
  children,
}: {
  client: ApiClient;
  children: ReactNode;
}) {
  return <ApiClientContext.Provider value={client}>{children}</ApiClientContext.Provider>;
}

export function useApiClient(): ApiClient {
  const client = useContext(ApiClientContext);
  if (!client) throw new Error('useApiClient must be used inside ApiClientProvider');
  return client;
}

export type { ApiClient };
