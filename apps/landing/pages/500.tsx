import { AlertTriangle } from 'lucide-react';

export default function Custom500() {
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
              background: 'rgba(239,68,68,0.15)',
              borderRadius: '9999px',
              padding: '1.5rem',
              display: 'inline-flex',
            }}
          >
            <AlertTriangle size={48} color="#ef4444" />
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
        <p style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', margin: '0 0 0.5rem' }}>
          Something went wrong
        </p>
        <p style={{ color: '#94a3b8', maxWidth: '22rem', margin: '0 auto 2rem' }}>
          We hit an unexpected snag on our end. Try again in a moment.
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
            Back to home
          </a>
          <a
            href="mailto:hello@packratai.com"
            style={{
              border: '1px solid #334155',
              color: '#f8fafc',
              padding: '0.625rem 1.5rem',
              borderRadius: '0.5rem',
              fontWeight: 600,
              textDecoration: 'none',
              fontSize: '1rem',
            }}
          >
            Contact support
          </a>
        </div>
      </div>
    </div>
  );
}
