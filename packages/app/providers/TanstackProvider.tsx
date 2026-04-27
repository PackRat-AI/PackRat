import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type React from 'react';

// Create a client
const queryClient = new QueryClient();

export function TanstackProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
