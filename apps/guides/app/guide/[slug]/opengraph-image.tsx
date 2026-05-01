import { getPostBySlug, getAllPosts } from 'guides-app/lib/mdx-static';
import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export async function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  const title = post?.title ?? 'PackRat Guides';
  const description = post?.description ?? 'Expert hiking and outdoor guides';
  const categories = post?.categories ?? [];

  return new ImageResponse(
    (
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
          <div style={{ fontSize: '28px' }}>🏔️</div>
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
            gap: '8px',
            color: 'rgba(255,255,255,0.6)',
            fontSize: '18px',
          }}
        >
          packrat.world/guides
        </div>
      </div>
    ),
    { ...size },
  );
}
