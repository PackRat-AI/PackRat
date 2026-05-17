import type { ReactElement } from 'react';

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;
export const OG_IMAGE_CONTENT_TYPE = 'image/png' as const;

/** Returns the JSX element for the Trails Open Graph / Twitter card image. */
export function getTrailsOgImageElement(): ReactElement {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #14532D 0%, #166534 60%, #15803D 100%)',
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
            width: '76px',
            height: '76px',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Simple mountain silhouette */}
          <div
            style={{
              width: '0',
              height: '0',
              borderLeft: '18px solid transparent',
              borderRight: '18px solid transparent',
              borderBottom: '30px solid rgba(255,255,255,0.9)',
            }}
          />
        </div>
        <div
          style={{
            fontSize: '60px',
            fontWeight: 700,
            color: 'white',
            letterSpacing: '-2px',
          }}
        >
          Trail Search
        </div>
      </div>
      <div
        style={{
          fontSize: '30px',
          color: 'rgba(255,255,255,0.9)',
          textAlign: 'center',
          maxWidth: '760px',
          lineHeight: 1.4,
          fontWeight: 500,
        }}
      >
        Discover hiking, cycling, and outdoor trails near you
      </div>
      <div
        style={{
          marginTop: '40px',
          display: 'flex',
          gap: '32px',
        }}
      >
        {['Hiking', 'Cycling', 'Outdoors'].map((tag) => (
          <div
            key={tag}
            style={{
              color: 'rgba(255,255,255,0.75)',
              fontSize: '20px',
              fontWeight: 500,
              background: 'rgba(255,255,255,0.12)',
              padding: '8px 20px',
              borderRadius: '100px',
            }}
          >
            {tag}
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: '40px',
          color: 'rgba(255,255,255,0.5)',
          fontSize: '18px',
        }}
      >
        Powered by PackRat
      </div>
    </div>
  );
}
