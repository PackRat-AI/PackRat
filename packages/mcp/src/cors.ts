/**
 * CORS allowlist for `/.well-known/*` endpoints.
 *
 * The `@cloudflare/workers-oauth-provider` library serves both well-known
 * endpoints (`oauth-protected-resource` and `oauth-authorization-server`)
 * directly — we can't intercept them inside `PackRatAuthHandler` because
 * the library routes them before the defaultHandler dispatch (same
 * constraint U4 hit with `/register`). Instead, the outer fetch wrapper
 * in `index.ts` calls `applyCorsHeaders` to:
 *
 *   - Short-circuit OPTIONS preflights from Claude origins with a 204
 *     (the library returns 405 for OPTIONS on its well-known routes,
 *     which would defeat the preflight).
 *   - Annotate GET responses from Claude origins with
 *     `Access-Control-Allow-Origin` + `Vary: Origin` after the provider
 *     returns its JSON.
 *
 * Default-deny: any origin not in the allowlist gets the upstream
 * response unmodified (no Access-Control-Allow-Origin), so browsers from
 * elsewhere see the same opaque cross-origin block they would today.
 *
 * Kept in its own module so unit tests can import it without pulling in
 * `agents/mcp` (which uses the `cloudflare:workers` scheme and breaks
 * Node-native vitest runs).
 */

/** Allowlist of origins that may discover the well-known metadata. */
export const WELL_KNOWN_ALLOWED_ORIGINS = new Set<string>([
  'https://claude.ai',
  'https://claude.com',
]);

const WELL_KNOWN_PREFIX = '/.well-known/';

/**
 * Apply CORS headers to a `/.well-known/*` response for the two Claude
 * origins. Returns:
 *   - a 204 preflight response for OPTIONS from an allowlisted origin
 *     (caller short-circuits past the OAuthProvider entirely so the
 *     library never sees the preflight)
 *   - an annotated clone of `existing` for GET when one is supplied
 *
 * Returns `null` when the request is not a well-known path or not an
 * allowlisted origin — caller passes the request through unchanged.
 */
export function applyCorsHeaders(request: Request, existing: Response | null): Response | null {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(WELL_KNOWN_PREFIX)) return null;

  const origin = request.headers.get('Origin');
  if (!origin || !WELL_KNOWN_ALLOWED_ORIGINS.has(origin)) return null;

  // Preflight: respond directly so the OAuthProvider library never sees
  // the OPTIONS request (it returns 405 for OPTIONS on its well-known
  // routes, which would defeat the preflight).
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        Vary: 'Origin',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '3600',
      },
    });
  }

  // GET: annotate the upstream provider response. We never strip body or
  // headers — only add the three CORS-related ones.
  if (existing && request.method === 'GET') {
    const annotated = new Response(existing.body, existing);
    annotated.headers.set('Access-Control-Allow-Origin', origin);
    // `Vary: Origin` is important: a downstream cache must not serve the
    // CORS-annotated response to a different origin.
    const existingVary = annotated.headers.get('Vary');
    annotated.headers.set('Vary', existingVary ? `${existingVary}, Origin` : 'Origin');
    return annotated;
  }

  return null;
}
