import { createApiClient } from '@packrat/api-client';
import { cache } from 'react';
import { getApiBaseUrl } from 'web-app/lib/getApiBaseUrl';

/**
 * Server-side client for the API's public, unauthenticated endpoints (share
 * pages). It never carries a session: the pages it backs are open to anyone
 * holding a link, so there is no token to attach and nothing to refresh.
 */
const publicApiClient = createApiClient({
  baseUrl: getApiBaseUrl(),
  auth: {
    getAccessToken: () => null,
    getRefreshToken: () => null,
    onAccessTokenRefreshed: () => {},
    onNeedsReauth: () => {},
  },
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A shared post for its public page, or `null` when there is nothing to show —
 * the id is malformed, or the post was deleted, hidden, or its author suspended.
 * Any other failure throws so the error boundary renders it rather than a
 * misleading "post removed". Wrapped in `cache` so `generateMetadata` and the
 * page share one request.
 */
export const getPublicPost = cache(async (publicId: string) => {
  if (!UUID_PATTERN.test(publicId)) return null;
  const { data, error } = await publicApiClient.feed.public({ publicId }).get();
  if (error?.status === 404) return null;
  if (error || !data) throw new Error(`Failed to load shared post: ${error?.status}`);
  return data;
});
