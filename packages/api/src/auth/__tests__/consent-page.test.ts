/**
 * Unit tests for the OAuth consent page renderer + handler.
 *
 * Coverage targets (from U1 plan):
 *   - admin user sees ALL approvable scopes including mcp:admin
 *   - non-admin user has mcp:admin filtered out of the form
 *   - unauthenticated request redirects to /api/auth/sign-in
 *   - unknown client_id returns 404
 *   - missing client_id returns 400
 *   - rendered HTML carries the expected anti-clickjacking + content-type headers
 */

import { type ConsentPageData, renderConsentPage } from '@packrat/consent-ui';
import { Elysia } from 'elysia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Route-level test setup ────────────────────────────────────────────────
//
// The unit-test config runs in plain Node — importing `@packrat/api/index`
// (the full app) pulls in @cloudflare/containers which extends a Workers-only
// base class. To exercise the /oauth/consent Elysia route in isolation, we:
//   1. Mock the route's external deps (`getAuth`, `createDb`, `getEnv`) at
//      module scope. vi.mock is hoisted so subsequent imports see the mocks.
//   2. Lazy-import `consentRoute` AFTER the mocks register, and mount it on a
//      throwaway Elysia instance for `.fetch(...)` calls.
//
// Each route test reshapes the mocks via mockImplementationOnce so behaviour
// is per-test (different session, different DB row).

const mockGetSession = vi.fn();
const mockSelectChain = vi.fn();

vi.mock('@packrat/api/auth', () => ({
  getAuth: vi.fn(async () => ({
    api: { getSession: mockGetSession },
  })),
}));

vi.mock('@packrat/api/db', () => ({
  createDb: vi.fn(() => ({ select: mockSelectChain })),
}));

vi.mock('@packrat/api/utils/env-validation', () => ({
  getEnv: vi.fn(() => ({ NEON_DATABASE_URL: 'postgres://stub' })),
}));

async function buildTestApp() {
  const { consentRoute } = await import('../consent-route');
  return new Elysia().use(consentRoute);
}

// Cached after first import to avoid re-mounting the route per test. Typed as
// the precise mounted-app type (Elysia's generics are invariant, so the bare
// `Elysia` type can't hold it).
let testApp: Awaited<ReturnType<typeof buildTestApp>> | undefined;

async function getTestApp(): Promise<Awaited<ReturnType<typeof buildTestApp>>> {
  if (!testApp) {
    testApp = await buildTestApp();
  }
  return testApp;
}

beforeEach(() => {
  mockGetSession.mockReset();
  mockSelectChain.mockReset();
});

function mockSession(user: { id: string; name?: string; email: string; role?: string } | null) {
  mockGetSession.mockResolvedValueOnce(user ? { user } : null);
}

function mockOauthClientRow(row: Record<string, unknown> | null) {
  const limit = vi.fn().mockResolvedValue(row ? [row] : []);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  mockSelectChain.mockReturnValueOnce({ from });
}

const baseUser = { name: 'Test User', email: 'user@example.com' };

const baseClient = {
  clientId: 'packrat-claude-mcp',
  name: 'Claude',
  icon: 'https://packratai.com/mcp-logo-256.png',
  tos: 'https://www.anthropic.com/legal/consumer-terms',
  policy: 'https://www.anthropic.com/legal/privacy',
  uri: 'https://claude.ai',
};

function makeData(overrides: Partial<ConsentPageData> = {}): ConsentPageData {
  return {
    user: baseUser,
    isAdmin: false,
    client: baseClient,
    requestedScopes: ['mcp:read', 'mcp:write', 'mcp:admin'],
    approvableScopes: ['mcp:read', 'mcp:write'],
    oauthQuery: 'client_id=packrat-claude-mcp&scope=mcp%3Aread+mcp%3Awrite+mcp%3Aadmin&sig=abc',
    ...overrides,
  };
}

describe('renderConsentPage()', () => {
  it('renders the client name in the header', () => {
    const html = renderConsentPage(makeData());
    expect(html).toContain('Claude wants to access your PackRat account');
  });

  it("renders the user's name and email as the signed-in identity", () => {
    const html = renderConsentPage(makeData());
    expect(html).toContain('Test User');
    expect(html).toContain('user@example.com');
  });

  it('renders only the approvable scopes as form inputs (non-admin path)', () => {
    const html = renderConsentPage(
      makeData({
        isAdmin: false,
        requestedScopes: ['mcp:read', 'mcp:write', 'mcp:admin'],
        approvableScopes: ['mcp:read', 'mcp:write'],
      }),
    );
    expect(html).toContain('value="mcp:read"');
    expect(html).toContain('value="mcp:write"');
    expect(html).not.toContain('value="mcp:admin"');
  });

  // ── scope serialization contract ─────────────────────────────────────────
  //
  // Better Auth's /oauth2/consent endpoint reads `scope` as a SINGLE
  // space-joined string (`ctx.body.scope?.split(" ")`, body schema
  // `scope: z.string().optional()`). Submitting one form field per scope all
  // named `scope` would collapse to a single value and silently grant only
  // one scope, breaking consent-time scope reduction. These tests pin the
  // contract: exactly one hidden `name="scope"` field carrying the
  // space-joined approvable set, and the per-scope checkboxes use a different
  // name so they never POST a `scope` field.

  it('submits a SINGLE space-joined hidden `scope` field (no-JS default = approvable set)', () => {
    const html = renderConsentPage(
      makeData({
        approvableScopes: ['mcp:read', 'mcp:write'],
      }),
    );
    // Exactly one hidden input named `scope`, value = space-joined set.
    expect(html).toContain('name="scope" value="mcp:read mcp:write"');
    // It is the only `name="scope"` field in the document (checkboxes use a
    // different name) — so the endpoint receives one space-joined string.
    expect(html.match(/name="scope"/g)).toHaveLength(1);
  });

  it('does NOT render any checkbox named `scope` (would break the single-string contract)', () => {
    const html = renderConsentPage(makeData());
    // Checkboxes drive UX only; they must not post a `scope` field.
    expect(html).not.toContain('type="checkbox" name="scope"');
    expect(html).toContain('type="checkbox" name="scope_option"');
  });

  it('includes the inline submit handler that joins checked scopes into the hidden field', () => {
    const html = renderConsentPage(makeData());
    expect(html).toContain('id="consent-form"');
    expect(html).toContain('id="consent-scope"');
    expect(html).toContain('input[name="scope_option"]:checked');
  });

  it('joins all approvable scopes (incl. mcp:admin) for the admin no-JS default', () => {
    const html = renderConsentPage(
      makeData({
        isAdmin: true,
        approvableScopes: ['mcp:read', 'mcp:write', 'mcp:admin'],
      }),
    );
    expect(html).toContain('name="scope" value="mcp:read mcp:write mcp:admin"');
    expect(html.match(/name="scope"/g)).toHaveLength(1);
  });

  it('renders mcp:admin as an approvable scope for admins', () => {
    const html = renderConsentPage(
      makeData({
        isAdmin: true,
        requestedScopes: ['mcp:read', 'mcp:write', 'mcp:admin'],
        approvableScopes: ['mcp:read', 'mcp:write', 'mcp:admin'],
      }),
    );
    expect(html).toContain('value="mcp:admin"');
  });

  it('renders the form posting to /api/auth/oauth2/consent', () => {
    const html = renderConsentPage(makeData());
    expect(html).toContain('action="/api/auth/oauth2/consent"');
  });

  it('echoes the oauth_query as a hidden input verbatim', () => {
    const html = renderConsentPage(makeData());
    expect(html).toContain(
      'name="oauth_query" value="client_id=packrat-claude-mcp&amp;scope=mcp%3Aread+mcp%3Awrite+mcp%3Aadmin&amp;sig=abc"',
    );
  });

  it('escapes HTML in the client name to prevent injection', () => {
    const html = renderConsentPage(
      makeData({
        client: { ...baseClient, name: '<script>alert(1)</script>' },
      }),
    );
    // The actual XSS protection: the `<` is encoded to `&lt;` so the
    // injected `<script>` cannot start a real script element. (kitajs's
    // `safe` attribute escapes `<`/`&`/`"`/`'` but not `>` — encoding `<`
    // alone is sufficient to prevent tag-break-out, and `>` alone is
    // harmless. The old hand-rolled escape encoded both for strict-spec
    // compliance; the security property is identical.)
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script');
  });

  it('renders client policy + tos links when present', () => {
    const html = renderConsentPage(makeData());
    expect(html).toContain('https://www.anthropic.com/legal/privacy');
    expect(html).toContain('https://www.anthropic.com/legal/consumer-terms');
  });

  it('falls back to a generic client name when name is missing', () => {
    const html = renderConsentPage(
      makeData({
        client: { ...baseClient, name: null },
      }),
    );
    expect(html).toContain('An MCP client wants to access your PackRat account');
  });

  it('renders accept and deny buttons with the correct submit values', () => {
    const html = renderConsentPage(makeData());
    // The form POSTs `accept=true` or `accept=false` per the plugin's
    // /oauth2/consent endpoint schema.
    expect(html).toContain('name="accept" value="true"');
    expect(html).toContain('name="accept" value="false"');
  });
});

describe('GET /oauth/consent (Elysia route)', () => {
  it('returns 400 when client_id is missing', async () => {
    const res = await (await getTestApp()).fetch(
      new Request('http://localhost/oauth/consent?scope=mcp%3Aread'),
    );
    expect(res.status).toBe(400);
  });

  it('redirects to /api/auth/sign-in when the user is not signed in', async () => {
    mockSession(null);
    const res = await (await getTestApp()).fetch(
      new Request('http://localhost/oauth/consent?client_id=packrat-claude-mcp&scope=mcp%3Aread'),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('/api/auth/sign-in');
    expect(res.headers.get('location')).toContain('callbackURL=');
  });

  it('returns 404 when the client_id does not exist in oauthClient', async () => {
    mockSession({ id: 'u1', email: 'u@e.com', role: 'USER' });
    mockOauthClientRow(null);
    const res = await (await getTestApp()).fetch(
      new Request('http://localhost/oauth/consent?client_id=unknown&scope=mcp%3Aread'),
    );
    expect(res.status).toBe(404);
  });

  it('renders the consent page (200, text/html) with mcp:admin stripped for non-admin', async () => {
    mockSession({ id: 'u1', name: 'Test User', email: 'u@e.com', role: 'USER' });
    mockOauthClientRow({
      clientId: 'packrat-claude-mcp',
      name: 'Claude',
      icon: null,
      tos: null,
      policy: null,
      uri: null,
    });
    const res = await (await getTestApp()).fetch(
      new Request(
        'http://localhost/oauth/consent?client_id=packrat-claude-mcp&scope=mcp%3Aread+mcp%3Awrite+mcp%3Aadmin&sig=abc',
      ),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');

    const html = await res.text();
    expect(html).toContain('Claude wants to access your PackRat account');
    expect(html).toContain('value="mcp:read"');
    expect(html).toContain('value="mcp:write"');
    expect(html).not.toContain('value="mcp:admin"');
  });

  it('renders mcp:admin for an admin user', async () => {
    mockSession({ id: 'u1', email: 'admin@e.com', role: 'ADMIN' });
    mockOauthClientRow({
      clientId: 'packrat-claude-mcp',
      name: 'Claude',
      icon: null,
      tos: null,
      policy: null,
      uri: null,
    });
    const res = await (await getTestApp()).fetch(
      new Request('http://localhost/oauth/consent?client_id=packrat-claude-mcp&scope=mcp%3Aadmin'),
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('value="mcp:admin"');
  });

  it('treats a session user with no role as non-admin (mcp:admin stripped)', async () => {
    // session.user.role is undefined → `?? 'USER'` fallback → isAdmin=false.
    mockSession({ id: 'u1', name: 'No Role', email: 'norole@e.com' });
    mockOauthClientRow({
      clientId: 'packrat-claude-mcp',
      name: 'Claude',
      icon: null,
      tos: null,
      policy: null,
      uri: null,
    });
    const res = await (await getTestApp()).fetch(
      new Request(
        'http://localhost/oauth/consent?client_id=packrat-claude-mcp&scope=mcp%3Aread+mcp%3Aadmin',
      ),
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('value="mcp:read"');
    expect(html).not.toContain('value="mcp:admin"');
  });

  it('renders with an empty scope set when the scope param is absent', async () => {
    // query.scope missing → `isString(...) ? : ''` takes the '' branch →
    // no approvable scopes, but the page still renders 200.
    mockSession({ id: 'u1', name: 'Test User', email: 'u@e.com', role: 'USER' });
    mockOauthClientRow({
      clientId: 'packrat-claude-mcp',
      name: 'Claude',
      icon: null,
      tos: null,
      policy: null,
      uri: null,
    });
    const res = await (await getTestApp()).fetch(
      new Request('http://localhost/oauth/consent?client_id=packrat-claude-mcp'),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('Claude wants to access your PackRat account');
    expect(html).not.toContain('value="mcp:admin"');
  });
});
