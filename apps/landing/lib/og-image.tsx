import type { ReactElement } from 'react';

export { OG_IMAGE_CONTENT_TYPE, OG_IMAGE_SIZE } from '../../shared/lib/og';

/** Returns the JSX element for the landing Open Graph / Twitter card image. */
export function getLandingOgImageElement(): ReactElement {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #0F766E 0%, #0D9488 60%, #14B8A6 100%)',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '60px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          marginBottom: '32px',
        }}
      >
        <div
          style={{
            width: '80px',
            height: '80px',
            background: 'rgba(255,255,255,0.25)',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              background: 'white',
              borderRadius: '50%',
              opacity: 0.9,
            }}
          />
        </div>
        <div
          style={{
            fontSize: '64px',
            fontWeight: 700,
            color: 'white',
            letterSpacing: '-2px',
          }}
        >
          PackRat
        </div>
      </div>
      <div
        style={{
          fontSize: '32px',
          color: 'rgba(255,255,255,0.9)',
          textAlign: 'center',
          maxWidth: '720px',
          lineHeight: 1.4,
          fontWeight: 500,
        }}
      >
        Stop overpacking. Start adventuring.
      </div>
      <div
        style={{
          marginTop: '40px',
          display: 'flex',
          gap: '48px',
        }}
      >
        {['10K+ Users', '4.8★ Rating', '100% Free'].map((stat) => (
          <div
            key={stat}
            style={{
              color: 'rgba(255,255,255,0.75)',
              fontSize: '20px',
              fontWeight: 500,
            }}
          >
            {stat}
          </div>
        ))}
      </div>
    </div>
  );
}
