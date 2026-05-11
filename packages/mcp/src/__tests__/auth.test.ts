/**
 * Tests for the PackRat MCP Worker OAuth flow.
 *
 * The worker is now wrapped with OAuthProvider, which:
 *  - Serves  GET/POST /token, POST /register, /.well-known/* automatically
 *  - Routes  /mcp (and sub-paths) to mcpApiHandler after token validation
 *  - Routes  everything else to PackRatAuthHandler (/, /health, /authorize, /login, /callback)
 *
 * Because OAuthProvider requires a real KV namespace (OAUTH_KV) and performs
 * cryptographic operations, we test the auth handler sub-units in isolation
 * and use a lightweight integration harness that mocks OAuthProvider + KV.
 */

import { describe, expect, it, vi } from 'vitest';

// ── Mock cloudflare:workers before any imports ────────────────────────────────

vi.mock('cloudflare:workers', () => ({
  WorkerEntrypoint: class {},
  DurableObject: class {},
}));

// ── Mock agents/mcp ───────────────────────────────────────────────────────────

vi.mock('agents/mcp', () => {
  class McpAgent {
    fetch(_request: Request): Promise<Response> {
      return Promise.resolve(new Response('{}', { status: 200 }));
    }
    static serve(_path: string) {
      return {
        fetch: vi.fn().mockResolvedValue(new Response('{"jsonrpc":"2.0"}', { status: 200 })),
      };
    }
  }
  return { McpAgent };
});

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: class {
    registerTool = vi.fn();
    registerResource = vi.fn();
    registerPrompt = vi.fn();
  },
  ResourceTemplate: class {
    constructor(
      public uriTemplate: string,
      _opts?: unknown,
    ) {}
  },
}));

// ── Mock OAuthProvider — returns a simple fetch handler for testing ────────────

vi.mock('@cloudflare/workers-oauth-provider', () => {
  class OAuthProvider {
    private opts: Record<string, unknown>;
    constructor(opts: Record<string, unknown>) {
      this.opts = opts;
    }
    // biome-ignore lint/complexity/useMaxParams: mirrors Cloudflare Workers fetch signature
    async fetch(request: Request, env: Record<string, unknown>, ctx: unknown): Promise<Response> {
      const url = new URL(request.url);

      // Simulate OAuthProvider routing:
      //  - /token  → token endpoint (handled by OAuthProvider itself)
      //  - /mcp*   → apiHandler (with props injected)
      //  - others  → defaultHandler

      if (url.pathname === '/token') {
        // Simulate token endpoint — return a minimal token response
        return Response.json({ access_token: 'test-token', token_type: 'Bearer' });
      }

      if (url.pathname === '/mcp' || url.pathname.startsWith('/mcp/')) {
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.match(/^Bearer\s+(\S+)/i)?.[1] ?? '';

        if (!token) {
          return Response.json(
            { error: 'unauthorized', error_description: 'Missing access token' },
            {
              status: 401,
              headers: { 'WWW-Authenticate': 'Bearer realm="packrat-mcp"' },
            },
          );
        }

        // Call the apiHandler with a props-augmented ctx
        const apiHandler = this.opts.apiHandler as {
          fetch: (req: Request, env: unknown, ctx: unknown) => Promise<Response>;
        };
        const augCtx = Object.assign({}, ctx, { props: { betterAuthToken: token, userId: 'u1' } });
        return apiHandler.fetch(request, env, augCtx);
      }

      // Route all other paths to defaultHandler
      const defaultHandler = this.opts.defaultHandler as {
        fetch: (req: Request, env: unknown) => Promise<Response>;
      };
      return defaultHandler.fetch(request, env);
    }
  }
  return { OAuthProvider, default: OAuthProvider };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeKv(initial: Record<string, string> = {}): KVNamespace {
  const store = new Map<string, { value: string; expiration?: number }>(
    Object.entries(initial).map(([k, v]) => [k, { value: v }]),
  );
  return {
    get: vi.fn(async (key: string) => store.get(key)?.value ?? null),
    // biome-ignore lint/complexity/useMaxParams: mirrors KVNamespace.put signature
    put: vi.fn(async (key: string, value: string, opts?: { expirationTtl?: number }) => {
      store.set(key, { value, expiration: opts?.expirationTtl });
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    getWithMetadata: vi.fn(),
    list: vi.fn(),
  } as unknown as KVNamespace;
}

function makeOAuthProvider() {
  return {
    parseAuthRequest: vi.fn().mockResolvedValue({
      responseType: 'code',
      clientId: 'test-client',
      redirectUri: 'https://client.example.com/cb',
      scope: ['mcp'],
      state: 'xyz',
    }),
    lookupClient: vi.fn().mockResolvedValue({
      clientId: 'test-client',
      redirectUris: ['https://client.example.com/cb'],
    }),
    completeAuthorization: vi.fn().mockResolvedValue({
      redirectTo: 'https://client.example.com/cb?code=abc&state=xyz',
    }),
  };
}

function makeEnv(kvOverrides: Record<string, string> = {}): import('../types').Env {
  return {
    PACKRAT_API_URL: 'https://api.example.com',
    OAUTH_KV: makeKv(kvOverrides),
    OAUTH_PROVIDER: makeOAuthProvider() as unknown as import('../types').Env['OAUTH_PROVIDER'],
    PackRatMCP: {} as unknown as DurableObjectNamespace,
  };
}

function req(url: string, init: RequestInit = {}): Request {
  return new Request(url, init);
}

// ── Import worker after all mocks ─────────────────────────────────────────────

const { default: worker } = await import('../index');
const fakeCtx = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
} as unknown as ExecutionContext;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('health check', () => {
  it('returns 200 for GET /', async () => {
    const env = makeEnv();
    const res = await worker.fetch(req('https://mcp.example.com/'), env, fakeCtx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe('ok');
    expect(body.service).toBe('packrat-mcp');
  });

  it('returns 200 for GET /health', async () => {
    const env = makeEnv();
    const res = await worker.fetch(req('https://mcp.example.com/health'), env, fakeCtx);
    expect(res.status).toBe(200);
  });
});

describe('/mcp auth guard', () => {
  it('returns 401 when Authorization header is absent', async () => {
    const env = makeEnv();
    const res = await worker.fetch(req('https://mcp.example.com/mcp'), env, fakeCtx);
    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toMatch(/Bearer/);
  });

  it('returns 401 for empty Bearer token', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      req('https://mcp.example.com/mcp', { headers: { Authorization: 'Bearer ' } }),
      env,
      fakeCtx,
    );
    expect(res.status).toBe(401);
  });

  it('forwards request to McpAgent when a valid Bearer token is provided', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      req('https://mcp.example.com/mcp', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
      }),
      env,
      fakeCtx,
    );
    expect(res.status).toBe(200);
  });
});

describe('PackRatAuthHandler – /authorize', () => {
  it('redirects to /login with a generated state key', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      req(
        'https://mcp.example.com/authorize?response_type=code&client_id=test-client&redirect_uri=https%3A%2F%2Fclient.example.com%2Fcb&scope=mcp&state=abc',
      ),
      env,
      fakeCtx,
    );
    expect(res.status).toBe(302);
    const location = res.headers.get('Location') ?? '';
    expect(location).toMatch(/\/login\?state=/);
  });

  it('stores OAuth state in KV', async () => {
    const env = makeEnv();
    await worker.fetch(
      req(
        'https://mcp.example.com/authorize?response_type=code&client_id=test-client&redirect_uri=https%3A%2F%2Fclient.example.com%2Fcb&scope=mcp&state=abc',
      ),
      env,
      fakeCtx,
    );
    expect(env.OAUTH_KV.put).toHaveBeenCalledWith(
      expect.stringMatching(/^oauth_state:/),
      expect.any(String),
      expect.objectContaining({ expirationTtl: 600 }),
    );
  });
});

describe('PackRatAuthHandler – /login', () => {
  it('GET /login serves an HTML form', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      req('https://mcp.example.com/login?state=some-key'),
      env,
      fakeCtx,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/text\/html/);
    const body = await res.text();
    expect(body).toContain('<form');
    expect(body).toContain('name="email"');
    expect(body).toContain('name="password"');
  });

  it('POST /login with valid credentials redirects to /callback', async () => {
    const stateKey = 'test-state-key';
    const env = makeEnv({
      [`oauth_state:${stateKey}`]: JSON.stringify({
        clientId: 'test-client',
        scope: ['mcp'],
        state: 'xyz',
        redirectUri: 'https://client.example.com/cb',
        responseType: 'code',
      }),
    });

    const origFetch = globalThis.fetch;
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ user: { id: 'user-123' }, session: { token: 'ba-token-abc' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ) as unknown as typeof fetch;

    const form = new URLSearchParams({
      email: 'test@example.com',
      password: 'secret',
      state: stateKey,
    });
    const res = await worker.fetch(
      req('https://mcp.example.com/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      }),
      env,
      fakeCtx,
    );

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toMatch(/\/callback\?state=/);
    expect(env.OAUTH_KV.put).toHaveBeenCalledWith(
      `session:${stateKey}`,
      expect.stringContaining('ba-token-abc'),
      expect.any(Object),
    );

    globalThis.fetch = origFetch;
  });

  it('POST /login with invalid credentials returns 401 HTML', async () => {
    const stateKey = 'test-state-key';
    const env = makeEnv({
      [`oauth_state:${stateKey}`]: JSON.stringify({
        clientId: 'c',
        scope: ['mcp'],
        state: 'x',
        redirectUri: 'https://x.com',
        responseType: 'code',
      }),
    });

    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid_credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    const form = new URLSearchParams({
      email: 'bad@example.com',
      password: 'wrong',
      state: stateKey,
    });
    const res = await worker.fetch(
      req('https://mcp.example.com/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      }),
      env,
      fakeCtx,
    );

    expect(res.status).toBe(401);
    const body = await res.text();
    expect(body).toContain('Invalid email or password');

    globalThis.fetch = origFetch;
  });
});

describe('PackRatAuthHandler – /callback', () => {
  it('completes OAuth authorization and redirects', async () => {
    const stateKey = 'cb-state-key';
    const env = makeEnv({
      [`oauth_state:${stateKey}`]: JSON.stringify({
        clientId: 'test-client',
        scope: ['mcp'],
        state: 'xyz',
        redirectUri: 'https://client.example.com/cb',
        responseType: 'code',
      }),
      [`session:${stateKey}`]: JSON.stringify({ token: 'ba-token', userId: 'user-123' }),
    });

    const res = await worker.fetch(
      req(`https://mcp.example.com/callback?state=${stateKey}`),
      env,
      fakeCtx,
    );

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('code=abc');
    expect(env.OAUTH_PROVIDER.completeAuthorization).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        props: { betterAuthToken: 'ba-token', userId: 'user-123' },
      }),
    );
  });

  it('returns 400 when state is missing from KV', async () => {
    const env = makeEnv(); // empty KV

    const res = await worker.fetch(
      req('https://mcp.example.com/callback?state=nonexistent'),
      env,
      fakeCtx,
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe('invalid_request');
  });
});

describe('unknown paths', () => {
  it('returns 404 for unknown paths', async () => {
    const env = makeEnv();
    const res = await worker.fetch(req('https://mcp.example.com/unknown'), env, fakeCtx);
    expect(res.status).toBe(404);
  });
});
