'use client';

/**
 * Next.js global-error replaces the root layout when an error escapes it,
 * so this component renders its own <html> and <body>. Styles are inlined
 * so a failed stylesheet can't cascade into a blank page.
 */
export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <head>
        <title>Something went wrong</title>
        <meta
          name="description"
          content="An unexpected error occurred while loading PackRat Guides. Try reloading the page or returning to all guides."
        />
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          color: '#111',
          background: '#fff',
        }}
      >
        <main style={{ maxWidth: '32rem', textAlign: 'center' }}>
          <p
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#0a84ff',
              margin: 0,
            }}
          >
            500
          </p>
          <h1
            style={{
              fontSize: '2.25rem',
              fontWeight: 600,
              margin: '0.75rem 0 0',
              lineHeight: 1.15,
            }}
          >
            Something went wrong
          </h1>
          <p style={{ marginTop: '1rem', fontSize: '1.0625rem', color: '#555', lineHeight: 1.5 }}>
            An unexpected error occurred while loading this page. You can try again, or head back to
            all PackRat guides.
          </p>
          <div
            style={{
              marginTop: '2rem',
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                appearance: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.625rem 1.25rem',
                borderRadius: '9999px',
                background: '#0a84ff',
                color: '#fff',
                fontSize: '0.9375rem',
                fontWeight: 500,
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0.625rem 1.25rem',
                borderRadius: '9999px',
                border: '1px solid #d2d2d7',
                color: '#111',
                fontSize: '0.9375rem',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Return to all guides
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
