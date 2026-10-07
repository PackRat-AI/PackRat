import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { GetTheApp, ShareHeader } from 'web-app/components/shared-post/get-the-app';
import { PhotoGallery } from 'web-app/components/shared-post/photo-gallery';
import { getPublicPost } from 'web-app/lib/public-api';
import { sharedPostAppUrl, sharedPostUrl } from 'web-app/lib/share-links';

type Props = { params: Promise<{ publicId: string }> };

function describe(caption: string | null, authorName: string): string {
  return caption?.trim() || `Photos from ${authorName}'s adventure, shared on PackRat.`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { publicId } = await params;
  const post = await getPublicPost(publicId);
  if (!post) return { title: 'Post not found · PackRat', robots: { index: false } };

  const title = `${post.authorName} on PackRat`;
  const description = describe(post.caption, post.authorName);
  const url = sharedPostUrl(post.publicId);
  const [cover] = post.images;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      siteName: 'PackRat',
      title,
      description,
      url,
      publishedTime: post.createdAt,
      images: cover ? [{ url: cover, alt: description }] : undefined,
    },
    twitter: {
      card: cover ? 'summary_large_image' : 'summary',
      title,
      description,
      images: cover ? [cover] : undefined,
    },
  };
}

export default async function SharedPostPage({ params }: Props) {
  const { publicId } = await params;
  const post = await getPublicPost(publicId);
  if (!post) notFound();

  const postedOn = new Date(post.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-[560px] pb-10">
        <ShareHeader />

        <article className="overflow-hidden border-border border-y bg-card sm:rounded-2xl sm:border-x">
          <div className="flex items-center gap-3 px-4 py-3">
            {post.authorAvatarUrl ? (
              <Image
                src={post.authorAvatarUrl}
                alt=""
                width={40}
                height={40}
                className="size-10 rounded-full object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="flex size-10 items-center justify-center rounded-full bg-secondary font-semibold"
              >
                {post.authorName.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold">{post.authorName}</p>
              <p className="text-muted-foreground text-xs">
                <time dateTime={post.createdAt}>{postedOn}</time>
              </p>
            </div>
          </div>

          {post.images.length > 0 ? (
            <PhotoGallery images={post.images} alt={`Photo shared by ${post.authorName}`} />
          ) : null}

          {post.caption ? (
            <p className="whitespace-pre-line break-words px-4 py-4 text-[15px] leading-relaxed">
              {post.caption}
            </p>
          ) : null}
        </article>

        <div className="mt-6 px-4 sm:px-0">
          <GetTheApp
            appUrl={sharedPostAppUrl(post.publicId)}
            title={`See more from ${post.authorName}`}
          />
        </div>
      </div>
    </div>
  );
}
