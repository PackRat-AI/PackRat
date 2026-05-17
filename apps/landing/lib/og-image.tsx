import type { ReactElement } from 'react';

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;
export const OG_IMAGE_CONTENT_TYPE = 'image/png' as const;

// PackRat mountain-chevron mark — white, viewBox trimmed to actual path bounds.
const MARK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 5 40 37'%3E%3Cpath fill='white' fill-rule='evenodd' d='m7.839 40.783 16.03-28.054L20 6 0 40.783h7.839Zm8.214 0H40L27.99 19.894l-4.02 7.032 3.976 6.914H20.02l-3.967 6.943Z' clip-rule='evenodd'/%3E%3C/svg%3E";

export function getLandingOgImageElement(): ReactElement {
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
      {/* Blue glow — top right */}
      <div
        style={{
          position: 'absolute',
          top: -200,
          right: -150,
          width: 700,
          height: 700,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(0,122,255,0.22) 0%, rgba(0,122,255,0.06) 45%, transparent 70%)',
          display: 'flex',
        }}
      />

      {/* Content column */}
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
        {/* Logo lockup */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src={MARK} width={38} height={35} alt="" />
          <span
            style={{ fontSize: 28, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.5px' }}
          >
            PackRat
          </span>
        </div>

        {/* Headline block — vertically centered */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
            gap: 20,
          }}
        >
          {/* Pill badge */}
          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              background: 'rgba(0,122,255,0.12)',
              border: '1px solid rgba(0,122,255,0.28)',
              borderRadius: 100,
              padding: '7px 20px',
              color: '#5EB0FF',
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: '0.2px',
            }}
          >
            Free on iOS & Android
          </div>

          {/* Two-line headline — second line dimmed for depth */}
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
              Stop overpacking.
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
              Start adventuring.
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
            Smart packing lists built for every adventure.
          </span>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {[
            { num: '10K+', lbl: 'USERS' },
            { num: '4.8★', lbl: 'RATING' },
            { num: '100%', lbl: 'FREE' },
          ].map(({ num, lbl }, i) => (
            <div key={lbl} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: '#FFFFFF', lineHeight: 1 }}>
                  {num}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.3)',
                    letterSpacing: '1.5px',
                    lineHeight: 1,
                  }}
                >
                  {lbl}
                </span>
              </div>
              {i < 2 && (
                <div
                  style={{
                    width: 1,
                    height: 36,
                    background: 'rgba(255,255,255,0.1)',
                    margin: '0 28px',
                    display: 'flex',
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
