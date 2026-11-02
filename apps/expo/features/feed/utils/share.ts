import type { Post } from '../types';

export const SHARE_BASE_URL = 'https://packratai.com';
const URL_PARTS = /^([a-z]+):\/\/([^/?#]*)(\/[^?#]*)?/i;
const WEB_HOSTS = Object.freeze(['packratai.com', 'www.packratai.com'] as const);

/** The link that opens a post in PackRat, or its web page for anyone without the app. */
export function postShareUrl(post: Pick<Post, 'publicId'>): string | null {
  return post.publicId ? `${SHARE_BASE_URL}/p/${post.publicId}` : null;
}

/**
 * The share-link id in a shared post URL — `https://packratai.com/p/{publicId}` or
 * `packrat://p/{publicId}` — or null for any other URL.
 */
export function sharedPostIdFromUrl(url: string): string | null {
  const match = URL_PARTS.exec(url.trim());
  if (!match) return null;
  const [, scheme = '', host = '', path = ''] = match;
  const lowerScheme = scheme.toLowerCase();
  let segments: string[];
  if (lowerScheme === 'https' || lowerScheme === 'http') {
    if (!(WEB_HOSTS as readonly string[]).includes(host.toLowerCase())) return null;
    segments = path.split('/').filter(Boolean);
  } else if (lowerScheme === 'packrat') {
    segments = [host, ...path.split('/').filter(Boolean)];
  } else {
    return null;
  }
  if (segments.length !== 2 || segments[0] !== 'p' || !segments[1]) return null;
  return segments[1];
}
