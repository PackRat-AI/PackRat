import type { ReactElement } from 'react';

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;
export const OG_IMAGE_CONTENT_TYPE = 'image/png' as const;

const MARK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 5 40 37'%3E%3Cpath fill='white' fill-rule='evenodd' d='m7.839 40.783 16.03-28.054L20 6 0 40.783h7.839Zm8.214 0H40L27.99 19.894l-4.02 7.032 3.976 6.914H20.02l-3.967 6.943Z' clip-rule='evenodd'/%3E%3C/svg%3E";

export function getTrailsOgImageElement(): ReactElement {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        background: '#09090B',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        position: 'relative',
      }}
    >
      {/* Green glow — top right */}
      <div
        style={{
          position: 'absolute',
          top: -200,
          right: -130,
          width: 680,
          height: 680,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(52,199,89,0.20) 0%, rgba(52,199,89,0.05) 45%, transparent 70%)',
          display: 'flex',
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '60px 72px',
          width: '100%',
          height: '100%',
          position: 'relative',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src={MARK} width={38} height={35} alt="" />
          <span
            style={{ fontSize: 28, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.5px' }}
          >
            PackRat
          </span>
        </div>

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
            gap: 20,
          }}
        >
          {/* Green pill */}
          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              background: 'rgba(52,199,89,0.10)',
              border: '1px solid rgba(52,199,89,0.25)',
              borderRadius: 100,
              padding: '7px 20px',
              color: '#4CD964',
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: '0.2px',
            }}
          >
            Trail Search
          </div>

          {/* Two-line headline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span
              style={{
                fontSize: 76,
                fontWeight: 800,
                color: '#FFFFFF',
                letterSpacing: '-3.5px',
                lineHeight: 1,
              }}
            >
              Discover trails
            </span>
            <span
              style={{
                fontSize: 76,
                fontWeight: 800,
                color: 'rgba(255,255,255,0.65)',
                letterSpacing: '-3.5px',
                lineHeight: 1,
              }}
            >
              near you.
            </span>
          </div>

          <span
            style={{
              fontSize: 26,
              color: 'rgba(255,255,255,0.42)',
              fontWeight: 400,
              lineHeight: 1.4,
            }}
          >
            Hiking, cycling, and outdoor trails — all in one place.
          </span>
        </div>

        {/* Activity tags + domain */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', gap: 10 }}>
            {['Hiking', 'Cycling', 'Outdoors'].map((tag) => (
              <div
                key={tag}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 100,
                  padding: '8px 18px',
                  color: 'rgba(255,255,255,0.55)',
                  fontSize: 16,
                  fontWeight: 500,
                }}
              >
                {tag}
              </div>
            ))}
          </div>
          <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.22)', fontWeight: 500 }}>
            trails.packratai.com
          </span>
        </div>
      </div>
    </div>
  );
}
