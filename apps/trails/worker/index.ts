interface Env {
  ASSETS: Fetcher;
  RATE_LIMITER: { limit(opts: { key: string }): Promise<{ success: boolean }> } | undefined;
  PACKRAT_API_BASE_URL: string;
}

const TRAIL_DETAIL_RE = /^\/api\/trails\/[^/]+$/;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function corsResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function proxyToApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  // Rate limit by IP
  if (env.RATE_LIMITER) {
    const ip =
      request.headers.get('CF-Connecting-IP') ??
      request.headers.get('X-Forwarded-For') ??
      'unknown';
    const { success } = await env.RATE_LIMITER.limit({ key: ip });
    if (!success) {
      return corsResponse(
        429,
        JSON.stringify({ error: 'Too many requests. Please try again in a moment.' }),
      );
    }
  }

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Build upstream URL
  const upstream = new URL(url.pathname + url.search, env.PACKRAT_API_BASE_URL);

  // Forward request with same headers (preserves Authorization Bearer token from client)
  const proxyRequest = new Request(upstream.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
  });

  try {
    const response = await fetch(proxyRequest);
    const responseBody = await response.text();

    // Add CORS headers to the proxied response
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      headers.set(key, value);
    }

    // Cache trail detail responses at edge (~1 hour TTL for non-search requests)
    if (TRAIL_DETAIL_RE.test(url.pathname) && request.method === 'GET') {
      headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=600');
    }

    return new Response(responseBody, { status: response.status, headers });
  } catch {
    return corsResponse(502, JSON.stringify({ error: 'API unavailable. Please try again later.' }));
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return proxyToApi(request, env);
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
