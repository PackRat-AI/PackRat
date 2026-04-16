import { Backpack } from 'lucide-react';

export default function Custom404() {
  return (
    <div
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
              background: 'rgba(15,118,110,0.15)',
              borderRadius: '9999px',
              padding: '1.5rem',
              display: 'inline-flex',
            }}
          >
            <Backpack size={48} color="#14b8a6" />
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
          404
        </h1>
        <p style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', margin: '0 0 0.5rem' }}>
          Page not found
        </p>
        <p style={{ color: '#94a3b8', maxWidth: '22rem', margin: '0 auto 2rem' }}>
          This admin page doesn&apos;t exist. Head back to the dashboard.
        </p>
        <a
          href="/dashboard"
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
          Back to dashboard
        </a>
      </div>
    </div>
  );
}
