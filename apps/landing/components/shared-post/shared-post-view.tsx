'use client';

import { safeJsonParse } from '@packrat/utils';
import { Button } from '@packrat/web-ui/components/button';
import { Skeleton } from '@packrat/web-ui/components/skeleton';
import { GetTheApp } from 'landing-app/components/shared-post/get-the-app';
import { PhotoGallery } from 'landing-app/components/shared-post/photo-gallery';
import {
  SHARED_POST_DATA_ID,
  type SharedPost,
  type SharedPostPayload,
  sharedPostAppUrl,
} from 'landing-app/lib/shared-post';
import { ImageOff, RotateCw } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';

/** The post the Worker embedded in the page. Absent when the static shell is served on its own. */
function readPayload(): SharedPostPayload {
  const text = document.getElementById(SHARED_POST_DATA_ID)?.textContent;
  if (!text) return { status: 'not-found' };
  try {
    return safeJsonParse<SharedPostPayload>(text, { strict: true });
  } catch {
    return { status: 'error' };
  }
}

export function SharedPostView() {
  const [payload, setPayload] = useState<SharedPostPayload | null>(null);

  useEffect(() => {
    setPayload(readPayload());
  }, []);

  return (
    <main className="flex-1 px-4 pt-24 pb-16 md:pt-28">
      <div className="mx-auto max-w-[560px] space-y-6">
        {payload === null ? <PostSkeleton /> : null}
        {payload?.status === 'ok' ? <PostCard post={payload.post} /> : null}
        {payload?.status === 'not-found' ? (
          <Unavailable
            title="This post isn't available"
            body="It may have been removed by the person who shared it, or the link may be incomplete."
          />
        ) : null}
        {payload?.status === 'error' ? (
          <Unavailable
            title="We couldn't load this post"
            body="Something went wrong on our end. Check your connection and try again."
            retry
          />
        ) : null}
        {payload ? (
          <GetTheApp
            appUrl={payload.status === 'ok' ? sharedPostAppUrl(payload.post.publicId) : undefined}
            title={
              payload.status === 'ok'
                ? `See more from ${payload.post.authorName}`
                : 'Find more adventures on PackRat'
            }
          />
        ) : null}
      </div>
    </main>
  );
}

function PostCard({ post }: { post: SharedPost }) {
  const postedOn = new Date(post.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <article className="apple-card overflow-hidden">
      <header className="flex items-center gap-3 px-4 py-3">
        {post.authorAvatarUrl ? (
          <Image
            src={post.authorAvatarUrl}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-apple-blue/10 font-semibold text-apple-blue"
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
      </header>

      {post.images.length > 0 ? (
        <PhotoGallery images={post.images} alt={`Photo shared by ${post.authorName}`} />
      ) : null}

      {post.caption ? (
        <p className="whitespace-pre-line break-words px-4 py-4 text-[15px] leading-relaxed">
          {post.caption}
        </p>
      ) : null}
    </article>
  );
}

function Unavailable({ title, body, retry }: { title: string; body: string; retry?: boolean }) {
  return (
    <div className="flex flex-col items-center px-6 pt-10 pb-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <ImageOff className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      </span>
      <h1 className="mt-5 font-semibold text-2xl tracking-tight">{title}</h1>
      <p className="mt-2 max-w-xs text-muted-foreground text-sm">{body}</p>
      {retry ? (
        <Button variant="outline" className="mt-5 rounded-full" onClick={() => location.reload()}>
          <RotateCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Try again
        </Button>
      ) : null}
    </div>
  );
}

function PostSkeleton() {
  return (
    <div className="apple-card overflow-hidden" aria-hidden="true">
      <div className="flex items-center gap-3 px-4 py-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="aspect-[4/5] w-full rounded-none" />
      <div className="space-y-2 px-4 py-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}
