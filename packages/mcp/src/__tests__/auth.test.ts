/**
 * Tests for the Worker entry-point fetch handler in src/index.ts.
 *
 * The Worker wraps the McpAgent with:
 *  - a health check at GET / and GET /health
 *  - bearer-auth guard for /mcp (no token → 401)
 *  - 404 for unknown paths
 *
 * We test this by importing the default export and calling its fetch() method
 * directly with a mocked Env and ExecutionContext.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../index';

// ── minimal Env and ExecutionContext fakes ────────────────────────────────────

const fakeEnv = {
  PACKRAT_API_URL: 'https://api.example.com',
  PackRatMCP: {
    // Durable Object namespace stub — `idFromName` + `get` + stub `fetch`
    idFromName: vi.fn().mockReturnValue({ toString: () => 'stub-id' }),
    get: vi.fn().mockReturnValue({
      fetch: vi.fn().mockResolvedValue(new Response('{}', { status: 200 })),
    }),
  },
} as unknown as Env;

const fakeCtx = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
} as unknown as ExecutionContext;

// ── stub agents/mcp so we do NOT spin up a real Durable Object ───────────────

vi.mock('agents/mcp', () => {
  // biome-ignore lint/complexity/noStaticOnlyClass: mock must be a class since PackRatMCP extends McpAgent
  class McpAgent {
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
}));

// ── import the Worker after mocks are in place ────────────────────────────────

const { default: worker } = await import('../index');

// ── helpers ───────────────────────────────────────────────────────────────────

function makeRequest(url: string, options: RequestInit = {}): Request {
  return new Request(url, options);
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('Worker fetch handler', () => {
  describe('health check', () => {
    it('returns 200 for GET /', async () => {
      const res = await worker.fetch(makeRequest('https://worker.example.com/'), fakeEnv, fakeCtx);
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.status).toBe('ok');
      expect(body.service).toBe('packrat-mcp');
    });

    it('returns 200 for GET /health', async () => {
      const res = await worker.fetch(
        makeRequest('https://worker.example.com/health'),
        fakeEnv,
        fakeCtx,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.status).toBe('ok');
    });
  });

  describe('/mcp auth guard', () => {
    it('returns 401 when Authorization header is absent', async () => {
      const res = await worker.fetch(
        makeRequest('https://worker.example.com/mcp'),
        fakeEnv,
        fakeCtx,
      );
      expect(res.status).toBe(401);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe('Unauthorized');
      expect(res.headers.get('WWW-Authenticate')).toMatch(/Bearer/);
    });

    it('returns 401 when Authorization is not Bearer scheme', async () => {
      const res = await worker.fetch(
        makeRequest('https://worker.example.com/mcp', {
          headers: { Authorization: 'Basic dXNlcjpwYXNz' },
        }),
        fakeEnv,
        fakeCtx,
      );
      expect(res.status).toBe(401);
    });

    it('returns 401 for empty Bearer token', async () => {
      const res = await worker.fetch(
        makeRequest('https://worker.example.com/mcp', {
          headers: { Authorization: 'Bearer ' },
        }),
        fakeEnv,
        fakeCtx,
      );
      expect(res.status).toBe(401);
    });

    it('forwards request to McpAgent when valid Bearer token is provided', async () => {
      const res = await worker.fetch(
        makeRequest('https://worker.example.com/mcp', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer valid-jwt-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
        }),
        fakeEnv,
        fakeCtx,
      );
      // The mock McpAgent.serve returns 200 — auth guard passed through
      expect(res.status).toBe(200);
    });

    it('also forwards sub-paths of /mcp with valid auth', async () => {
      const res = await worker.fetch(
        makeRequest('https://worker.example.com/mcp/session/abc', {
          headers: { Authorization: 'Bearer some-token' },
        }),
        fakeEnv,
        fakeCtx,
      );
      expect(res.status).toBe(200);
    });
  });

  describe('unknown paths', () => {
    it('returns 404 for unknown paths', async () => {
      const res = await worker.fetch(
        makeRequest('https://worker.example.com/unknown'),
        fakeEnv,
        fakeCtx,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe('Not Found');
    });

    it('returns 404 for /api paths', async () => {
      const res = await worker.fetch(
        makeRequest('https://worker.example.com/api/v1/packs'),
        fakeEnv,
        fakeCtx,
      );
      expect(res.status).toBe(404);
    });
  });
});
