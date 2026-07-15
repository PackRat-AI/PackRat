/**
 * CORS allowlist for `/.well-known/*` endpoints.
 *
 * After U3+U4 the MCP worker hand-rolls the `oauth-protected-resource`
 * document in the outer fetch wrapper (`index.ts`); the matching
 * `oauth-authorization-server` doc is served by the API worker. Either
 * way, Claude probes the document with an OPTIONS preflight from a
 * Claude origin before the real GET, so the outer wrapper in `index.ts`
 * calls `applyCorsHeaders` to:
 *
 *   - Short-circuit OPTIONS preflights from Claude origins with a 204.
 *   - Annotate GET responses from Claude origins with
 *     `Access-Control-Allow-Origin` + `Vary: Origin` after the metadata
 *     handler returns its JSON.
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

/**
 * localhost origins get CORS on /.well-known/* AND /mcp so MCP Inspector's
 * "Direct" connection mode can see the 401 WWW-Authenticate header, drive
 * OAuth discovery, and make authenticated tool calls — all without the proxy.
 */
const LOCALHOST_ORIGIN = /^http:\/\/localhost:\d+$/;

/**
 * Apply CORS headers to any response for localhost origins.
 * Used by the outer fetch handler to cover /mcp 401 responses and
 * authenticated DO responses in MCP Inspector direct-connection mode.
 */
export function applyLocalhostCors({
  request,
  existing,
}: {
  request: Request;
  existing: Response;
}): Response | null {
  const origin = request.headers.get('Origin');
  if (!origin || !LOCALHOST_ORIGIN.test(origin)) return null;

  // OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        Vary: 'Origin',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, mcp-session-id',
        'Access-Control-Expose-Headers': 'WWW-Authenticate, mcp-session-id',
        'Access-Control-Max-Age': '3600',
      },
    });
  }

  const annotated = new Response(existing.body, existing);
  annotated.headers.set('Access-Control-Allow-Origin', origin);
  annotated.headers.set('Access-Control-Expose-Headers', 'WWW-Authenticate, mcp-session-id');
  const existingVary = annotated.headers.get('Vary');
  annotated.headers.set('Vary', existingVary ? `${existingVary}, Origin` : 'Origin');
  return annotated;
}

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
export function applyCorsHeaders({
  request,
  existing,
}: {
  request: Request;
  existing: Response | null;
}): Response | null {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(WELL_KNOWN_PREFIX)) return null;

  const origin = request.headers.get('Origin');
  if (!origin || (!WELL_KNOWN_ALLOWED_ORIGINS.has(origin) && !LOCALHOST_ORIGIN.test(origin)))
    return null;

  // Preflight: respond directly so the well-known handler never sees the
  // OPTIONS request (it only knows GET).
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

  // GET: annotate the upstream metadata response. We never strip body or
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
