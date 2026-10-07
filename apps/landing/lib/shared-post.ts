/**
 * Shared-post pages (`packratai.com/p/{publicId}`). Used by both halves of the
 * page: the Worker in `worker/index.ts`, which fetches the post and writes its
 * link-preview tags into the static `/p` shell, and the client view that
 * renders it. Kept free of React and Next imports so the Worker can bundle it.
 */
import { isArray, isString, toRecord } from '@packrat/guards';
import { safeJsonStringify } from '@packrat/utils';
import { siteConfig } from '../config/site';

/** `GET /api/feed/public/:publicId` response. Mirrors `PublicPostSchema` in `@packrat/schemas`. */
export type SharedPost = {
  publicId: string;
  caption: string | null;
  /** Absolute image URLs, in display order. */
  images: string[];
  createdAt: string;
  authorName: string;
  authorAvatarUrl: string | null;
};

const nullableString = (value: unknown): string | null | undefined =>
  value === null ? null : isString(value) ? value : undefined;

/** Narrows the public-post API response, or `undefined` if it isn't one. */
export function toSharedPost(value: unknown): SharedPost | undefined {
  const r = toRecord(value);
  const caption = nullableString(r.caption);
  const authorAvatarUrl = nullableString(r.authorAvatarUrl);
  if (
    !isString(r.publicId) ||
    !isString(r.createdAt) ||
    !isString(r.authorName) ||
    caption === undefined ||
    authorAvatarUrl === undefined ||
    !isArray(r.images) ||
    !r.images.every(isString)
  ) {
    return undefined;
  }
  return {
    publicId: r.publicId,
    caption,
    images: r.images,
    createdAt: r.createdAt,
    authorName: r.authorName,
    authorAvatarUrl,
  };
}

/**
 * What the Worker hands the page, embedded as JSON in the HTML. The browser
 * never calls the API itself: the API does not allow the `packratai.com`
 * origin, and the Worker has already fetched the post for the preview tags.
 */
export type SharedPostPayload =
  | { status: 'ok'; post: SharedPost }
  | { status: 'not-found' }
  | { status: 'error' };

/** `id` of the `<script type="application/json">` carrying the payload. */
export const SHARED_POST_DATA_ID = 'shared-post-data';

export const APP_STORE_URL = siteConfig.download.appStoreLink;
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.packratai.mobile';

const SHARE_PATH_PATTERN = /^\/p\/([^/]+)\/?$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The post id in a `/p/{publicId}` path, or `null` when the path is not a well-formed share link. */
export function parsePublicId(pathname: string): string | null {
  const match = SHARE_PATH_PATTERN.exec(pathname);
  const id = match?.[1];
  return id && UUID_PATTERN.test(id) ? id.toLowerCase() : null;
}

export function sharedPostUrl(publicId: string): string {
  return `${siteConfig.url}/p/${publicId}`;
}

/** Custom-scheme link the apps route to the post. A tap on a same-domain link
 *  never triggers the universal link, so the page needs this to open the app. */
export function sharedPostAppUrl(publicId: string): string {
  return `packrat://p/${publicId}`;
}

export function sharedPostTitle(post: Pick<SharedPost, 'authorName'>): string {
  return `${post.authorName} on PackRat`;
}

export function sharedPostDescription(post: Pick<SharedPost, 'caption' | 'authorName'>): string {
  return post.caption?.trim() || `Photos from ${post.authorName}'s adventure, shared on PackRat.`;
}

type MetaTag = { property: string; content: string } | { name: string; content: string };

/** Link-preview tags for a post: Open Graph for Messages, WhatsApp, Facebook and Slack; Twitter for X. */
export function sharedPostMetaTags(post: SharedPost): MetaTag[] {
  const title = sharedPostTitle(post);
  const description = sharedPostDescription(post);
  const [cover] = post.images;
  return [
    { name: 'description', content: description },
    { property: 'og:type', content: 'article' },
    { property: 'og:site_name', content: siteConfig.name },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: sharedPostUrl(post.publicId) },
    { property: 'article:published_time', content: post.createdAt },
    ...(cover
      ? [
          { property: 'og:image', content: cover },
          { property: 'og:image:alt', content: description },
        ]
      : []),
    { name: 'twitter:card', content: cover ? 'summary_large_image' : 'summary' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    ...(cover ? [{ name: 'twitter:image', content: cover }] : []),
  ];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function renderMetaTags(tags: MetaTag[]): string {
  return tags
    .map((tag) => {
      const key =
        'property' in tag
          ? `property="${escapeHtml(tag.property)}"`
          : `name="${escapeHtml(tag.name)}"`;
      return `<meta ${key} content="${escapeHtml(tag.content)}">`;
    })
    .join('');
}

/** The payload as a JSON `<script>`. `<` is escaped so a caption cannot close the tag early. */
export function renderPayloadScript(payload: SharedPostPayload): string {
  const json = safeJsonStringify(payload).replaceAll('<', '\\u003c');
  return `<script id="${SHARED_POST_DATA_ID}" type="application/json">${json}</script>`;
}
