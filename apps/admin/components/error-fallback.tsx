'use client';

import { Button } from '@packrat/web-ui/components/button';
import type { FallbackProps } from 'react-error-boundary';

export function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        {error instanceof Error ? error.message : 'An unexpected error occurred.'}
      </p>
      <Button onClick={resetErrorBoundary} variant="outline" size="sm">
        Try again
      </Button>
    </div>
  );
}
