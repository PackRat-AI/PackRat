// Overrides Next.js internal _error page for /500 during static export.
// See pages/404.tsx for explanation.
import { AlertTriangle } from 'lucide-react';
import Head from 'next/head';

export default function Custom500() {
  return (
    <>
      <Head>
        <title>Something went wrong | PackRat Guides</title>
        <meta
          name="description"
          content="An unexpected error occurred while loading PackRat Guides. Try reloading the page or returning to all guides."
        />
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center', padding: '0 1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <div
              style={{
                background: 'rgba(239,68,68,0.15)',
                borderRadius: '9999px',
                padding: '1.5rem',
                display: 'inline-flex',
              }}
            >
              <AlertTriangle size={48} color="#ef4444" aria-hidden="true" />
            </div>
          </div>
          <h1
            style={{
              fontSize: '5rem',
              fontWeight: 800,
              color: '#f8fafc',
              margin: '0 0 0.5rem',
              lineHeight: 1,
            }}
          >
            500
          </h1>
          <p
            style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', margin: '0 0 0.5rem' }}
          >
            Something went wrong
          </p>
          <p style={{ color: '#94a3b8', maxWidth: '22rem', margin: '0 auto 2rem' }}>
            We hit an unexpected snag on our end. Try reloading, or head back to all guides.
          </p>
          <div
            style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}
          >
            <a
              href="/"
              style={{
                background: '#0f766e',
                color: '#fff',
                padding: '0.625rem 1.5rem',
                borderRadius: '0.5rem',
                fontWeight: 600,
                textDecoration: 'none',
                fontSize: '1rem',
              }}
            >
              Return to all guides
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
