import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #1E3A5F 0%, #1a56a0 60%, #0284C7 100%)',
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
            gap: '20px',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              width: '72px',
              height: '72px',
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '40px',
            }}
          >
            🏔️
          </div>
          <div
            style={{
              fontSize: '60px',
              fontWeight: 700,
              color: 'white',
              letterSpacing: '-2px',
            }}
          >
            PackRat Guides
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
          Expert hiking and outdoor guides for your next adventure
        </div>
      </div>
    ),
    { ...size },
  );
}
