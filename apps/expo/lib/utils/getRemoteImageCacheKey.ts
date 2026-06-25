// Derives a stable, filesystem-safe cache key for a remote image URL.
//
// ImageCacheManager uses the key directly as a flat filename (`${dir}${key}`), so the
// key must not contain slashes, query strings, or other path-unsafe characters. Remote
// URLs (e.g. OAuth provider avatars) do, so we hash the full URL into a short token and
// preserve a sanitized extension when one is present for readability.

const QUERY_OR_HASH_RE = /[?#]/;
const EXTENSION_RE = /\.([a-zA-Z0-9]{1,5})$/;

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // 32-bit FNV prime multiply via shifts to stay in integer range.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(36);
}

export function getRemoteImageCacheKey(url: string, prefix = 'remote-img'): string {
  const withoutQuery = url.split(QUERY_OR_HASH_RE)[0] ?? url;
  const lastSegment = withoutQuery.split('/').pop() ?? '';
  const match = lastSegment.match(EXTENSION_RE);
  const ext = match?.[1] ? `.${match[1].toLowerCase()}` : '';
  return `${prefix}-${fnv1a(url)}${ext}`;
}
