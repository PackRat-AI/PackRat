import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
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
          🎒
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
        Your AI-powered outdoor adventure companion. Free forever.
      </div>
    </div>,
    { ...size },
  );
}
