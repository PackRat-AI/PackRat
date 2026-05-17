import type { ReactElement } from 'react';

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;
export const OG_IMAGE_CONTENT_TYPE = 'image/png' as const;

const MARK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 5 40 37'%3E%3Cpath fill='white' fill-rule='evenodd' d='m7.839 40.783 16.03-28.054L20 6 0 40.783h7.839Zm8.214 0H40L27.99 19.894l-4.02 7.032 3.976 6.914H20.02l-3.967 6.943Z' clip-rule='evenodd'/%3E%3C/svg%3E";

export function getGuidesOgImageElement(): ReactElement {
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
          top: -160,
          right: -100,
          width: 620,
          height: 620,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(0,122,255,0.18) 0%, rgba(0,122,255,0.05) 50%, transparent 70%)',
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
        {/* Logo — stacked "PackRat / GUIDES" wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src={MARK} width={38} height={35} alt="" />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: '#FFFFFF',
                letterSpacing: '-0.3px',
                lineHeight: 1,
              }}
            >
              PackRat
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#007AFF',
                letterSpacing: '2px',
                lineHeight: 1.4,
              }}
            >
              GUIDES
            </span>
          </div>
        </div>

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
            gap: 22,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span
              style={{
                fontSize: 72,
                fontWeight: 800,
                color: '#FFFFFF',
                letterSpacing: '-3px',
                lineHeight: 1,
              }}
            >
              Expert hiking
            </span>
            <span
              style={{
                fontSize: 72,
                fontWeight: 800,
                color: 'rgba(255,255,255,0.65)',
                letterSpacing: '-3px',
                lineHeight: 1,
              }}
            >
              & outdoor guides.
            </span>
          </div>

          <span
            style={{
              fontSize: 25,
              color: 'rgba(255,255,255,0.42)',
              fontWeight: 400,
              lineHeight: 1.4,
            }}
          >
            Gear tips, trip planning, and trail skills.
          </span>
        </div>

        {/* Category tags + domain */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', gap: 10 }}>
            {['Trail Guides', 'Gear Reviews', 'Survival Skills'].map((tag) => (
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
            guides.packratai.com
          </span>
        </div>
      </div>
    </div>
  );
}

export interface PostOgImageProps {
  title: string;
  description: string;
  categories?: string[];
}

export function getPostOgImageElement({
  title,
  description,
  categories = [],
}: PostOgImageProps): ReactElement {
  const titleSize = title.length > 60 ? 46 : title.length > 40 ? 56 : 64;

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
          top: -180,
          right: -80,
          width: 560,
          height: 560,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(0,122,255,0.15) 0%, rgba(0,122,255,0.04) 50%, transparent 70%)',
          display: 'flex',
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 72px',
          width: '100%',
          height: '100%',
          position: 'relative',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={MARK} width={28} height={26} alt="" />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.8)',
                letterSpacing: '-0.3px',
              }}
            >
              PackRat
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#007AFF',
                letterSpacing: '2px',
              }}
            >
              GUIDES
            </span>
          </div>
        </div>

        {/* Post content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: '960px' }}>
          {categories.length > 0 && (
            <div style={{ display: 'flex', gap: 10 }}>
              {categories.slice(0, 3).map((cat) => (
                <div
                  key={cat}
                  style={{
                    background: 'rgba(0,122,255,0.12)',
                    border: '1px solid rgba(0,122,255,0.25)',
                    borderRadius: 100,
                    padding: '5px 16px',
                    color: '#5EB0FF',
                    fontSize: 15,
                    fontWeight: 600,
                  }}
                >
                  {cat}
                </div>
              ))}
            </div>
          )}

          <span
            style={{
              fontSize: titleSize,
              fontWeight: 800,
              color: '#FFFFFF',
              lineHeight: 1.1,
              letterSpacing: '-2px',
            }}
          >
            {title}
          </span>

          <span
            style={{
              fontSize: 22,
              color: 'rgba(255,255,255,0.48)',
              lineHeight: 1.4,
              fontWeight: 400,
            }}
          >
            {description.length > 120 ? `${description.slice(0, 117)}...` : description}
          </span>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.2)', fontWeight: 500 }}>
            guides.packratai.com
          </span>
        </div>
      </div>
    </div>
  );
}
