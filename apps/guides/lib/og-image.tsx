import type { ReactElement } from 'react';

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;
export const OG_IMAGE_CONTENT_TYPE = 'image/png' as const;

/** Returns the JSX element for the root Guides Open Graph / Twitter card image. */
export function getGuidesOgImageElement(): ReactElement {
  return (
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
          <div
            style={{
              width: '0',
              height: '0',
              borderLeft: '20px solid transparent',
              borderRight: '20px solid transparent',
              borderBottom: '34px solid white',
              opacity: 0.9,
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
      <div
        style={{
          marginTop: '40px',
          display: 'flex',
          gap: '48px',
        }}
      >
        {['Trail Guides', 'Gear Reviews', 'Survival Skills'].map((tag) => (
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
    </div>
  );
}

export interface PostOgImageProps {
  title: string;
  description: string;
  categories?: string[];
}

/** Returns the JSX element for a per-guide-post Open Graph image. */
export function getPostOgImageElement({
  title,
  description,
  categories = [],
}: PostOgImageProps): ReactElement {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1E3A5F 0%, #1a56a0 60%, #0284C7 100%)',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '64px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '0',
            height: '0',
            borderLeft: '9px solid transparent',
            borderRight: '9px solid transparent',
            borderBottom: '16px solid rgba(255,255,255,0.7)',
          }}
        />
        <div
          style={{
            fontSize: '26px',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.8)',
          }}
        >
          PackRat Guides
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {categories.length > 0 && (
          <div style={{ display: 'flex', gap: '12px' }}>
            {categories.slice(0, 3).map((cat) => (
              <div
                key={cat}
                style={{
                  background: 'rgba(255,255,255,0.18)',
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: '18px',
                  fontWeight: 500,
                  padding: '6px 16px',
                  borderRadius: '100px',
                }}
              >
                {cat}
              </div>
            ))}
          </div>
        )}
        <div
          style={{
            fontSize: title.length > 50 ? '44px' : '56px',
            fontWeight: 700,
            color: 'white',
            lineHeight: 1.15,
            letterSpacing: '-1px',
            maxWidth: '900px',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: '24px',
            color: 'rgba(255,255,255,0.8)',
            lineHeight: 1.4,
            maxWidth: '820px',
          }}
        >
          {description.length > 120 ? `${description.slice(0, 117)}...` : description}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          color: 'rgba(255,255,255,0.6)',
          fontSize: '18px',
        }}
      >
        guides.packratai.com
      </div>
    </div>
  );
}
