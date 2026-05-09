'use client';
import { ApiClientProvider } from '@packrat/app';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import type React from 'react';
import { apiClient } from 'web-app/lib/api';
import { getQueryClient } from 'web-app/lib/query-client';

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <ApiClientProvider client={apiClient}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
        </ThemeProvider>
      </ApiClientProvider>
    </QueryClientProvider>
  );
}
