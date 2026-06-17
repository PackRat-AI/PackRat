import type { ReactElement } from 'react';

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;
export const OG_IMAGE_CONTENT_TYPE = 'image/png' as const;

const MARK =
  'data:image/png;base64,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';

export function getGuidesOgImageElement(): ReactElement {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#000000',
        padding: '64px 80px',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      {/* Header: mark + stacked wordmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <img src={MARK} width={40} height={40} alt="" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span
            style={{
              fontSize: 26,
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
              fontSize: 11,
              fontWeight: 700,
              color: '#007AFF',
              letterSpacing: '2.5px',
              lineHeight: 1,
            }}
          >
            GUIDES
          </span>
        </div>
      </div>

      {/* Center: headline block */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          justifyContent: 'center',
          gap: 20,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span
            style={{
              fontSize: 76,
              fontWeight: 800,
              color: '#FFFFFF',
              letterSpacing: '-3.5px',
              lineHeight: 1,
            }}
          >
            Expert hiking
          </span>
          <span
            style={{
              fontSize: 76,
              fontWeight: 800,
              color: 'rgba(255,255,255,0.5)',
              letterSpacing: '-3.5px',
              lineHeight: 1,
            }}
          >
            & outdoor guides.
          </span>
        </div>

        <span
          style={{
            fontSize: 26,
            color: 'rgba(255,255,255,0.4)',
            fontWeight: 400,
            lineHeight: 1.4,
          }}
        >
          Gear tips, trip planning, and trail skills.
        </span>
      </div>

      {/* Footer: tags + domain */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          {['Trail Guides', 'Gear Reviews', 'Survival Skills'].map((tag) => (
            <div
              key={tag}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 100,
                padding: '8px 18px',
                color: 'rgba(255,255,255,0.5)',
                fontSize: 15,
                fontWeight: 500,
              }}
            >
              {tag}
            </div>
          ))}
        </div>
        <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.2)', fontWeight: 500 }}>
          guides.packratai.com
        </span>
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
        flexDirection: 'column',
        background: '#000000',
        padding: '56px 80px',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      {/* Header: mark + inline wordmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src={MARK} width={32} height={32} alt="" />
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
              fontSize: 11,
              fontWeight: 700,
              color: '#007AFF',
              letterSpacing: '2px',
            }}
          >
            GUIDES
          </span>
        </div>
      </div>

      {/* Post content — vertically centered */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          justifyContent: 'center',
          gap: 18,
          maxWidth: '960px',
        }}
      >
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
                  color: '#007AFF',
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
            color: 'rgba(255,255,255,0.45)',
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
  );
}
