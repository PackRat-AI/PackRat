'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          display: 'flex',
          minHeight: '100vh',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Something went wrong</h2>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', maxWidth: '24rem', margin: 0 }}>
          {error.message || 'An unexpected error occurred.'}
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            padding: '0.375rem 0.875rem',
            fontSize: '0.875rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.375rem',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
