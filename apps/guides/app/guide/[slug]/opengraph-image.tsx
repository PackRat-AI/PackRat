import { getAllPosts, getPostBySlug } from 'guides-app/lib/mdx-static';
import {
  getPostOgImageElement,
  OG_IMAGE_CONTENT_TYPE,
  OG_IMAGE_SIZE,
} from 'guides-app/lib/og-image';
import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export async function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  return new ImageResponse(
    getPostOgImageElement({
      title: post?.title ?? 'PackRat Guides',
      description: post?.description ?? 'Expert hiking and outdoor guides',
      categories: post?.categories ?? [],
    }),
    { ...size },
  );
}
