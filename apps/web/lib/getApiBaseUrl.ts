import { webEnv } from '@packrat/env/web';

const WEB_HOST_SUFFIX = 'web.localhost';

/**
 * Resolves the PackRat API base URL for the web app.
 *
 * Priority:
 *  1. Explicit `NEXT_PUBLIC_API_URL` — production, CI, or a manually-set portless URL.
 *  2. Under the portless dev proxy: derive the API's sibling origin from the page's own
 *     origin. The web app is served at `[<worktree>.]web.localhost[:port]` and the API at
 *     `[<worktree>.]api.localhost[:port]`, so swapping the `web` label to `api` keeps the
 *     per-worktree prefix and port automatically — no per-worktree env wiring needed.
 *  3. Fall back to the conventional local API port for direct (non-portless) runs.
 */
export function getApiBaseUrl(): string {
  if (webEnv.NEXT_PUBLIC_API_URL) return webEnv.NEXT_PUBLIC_API_URL;

  if (typeof window !== 'undefined') {
    const { origin, hostname } = window.location;
    // host is `[<worktree>.]web.localhost`; swap the `web` app-label to `api`.
    if (hostname === WEB_HOST_SUFFIX || hostname.endsWith(`.${WEB_HOST_SUFFIX}`)) {
      const apiHostname = `${hostname.slice(0, -WEB_HOST_SUFFIX.length)}api.localhost`;
      return origin.replace(hostname, apiHostname);
    }
  }

  return 'http://localhost:8787';
}
