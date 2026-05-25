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

import { describe, expect, it, vi } from 'vitest';
import { type ConsentPageData, handleConsentPage, renderConsentPage } from '../consent-page';

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
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
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

describe('handleConsentPage()', () => {
  it('returns 400 when client_id is missing', async () => {
    const req = new Request('https://api.packrat.world/oauth/consent?scope=mcp%3Aread');
    const auth = { api: { getSession: vi.fn() } };
    const db = { select: vi.fn() };
    const schema = { oauthClient: { clientId: 'client_id' } };

    const res = await handleConsentPage(req, {
      auth: auth as never,
      db: db as never,
      schema: schema as never,
    });
    expect(res.status).toBe(400);
  });

  it('redirects to /api/auth/sign-in when the user is not signed in', async () => {
    const req = new Request(
      'https://api.packrat.world/oauth/consent?client_id=packrat-claude-mcp&scope=mcp%3Aread',
    );
    const auth = { api: { getSession: vi.fn().mockResolvedValue(null) } };
    const db = { select: vi.fn() };
    const schema = { oauthClient: { clientId: 'client_id' } };

    const res = await handleConsentPage(req, {
      auth: auth as never,
      db: db as never,
      schema: schema as never,
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('/api/auth/sign-in');
    expect(res.headers.get('location')).toContain('callbackURL=');
  });

  it('returns 404 when the client_id does not exist in oauthClient', async () => {
    const req = new Request(
      'https://api.packrat.world/oauth/consent?client_id=unknown&scope=mcp%3Aread',
    );
    const auth = {
      api: {
        getSession: vi.fn().mockResolvedValue({
          user: { id: 'u1', email: 'u@e.com', role: 'USER' },
        }),
      },
    };
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const db = { select: vi.fn().mockReturnValue({ from }) };
    const schema = { oauthClient: { clientId: 'client_id' } };

    const res = await handleConsentPage(req, {
      auth: auth as never,
      db: db as never,
      schema: schema as never,
    });
    expect(res.status).toBe(404);
  });

  it('renders the consent page (200, text/html) with mcp:admin stripped for non-admin', async () => {
    const req = new Request(
      'https://api.packrat.world/oauth/consent?client_id=packrat-claude-mcp&scope=mcp%3Aread+mcp%3Awrite+mcp%3Aadmin&sig=abc',
    );
    const auth = {
      api: {
        getSession: vi.fn().mockResolvedValue({
          user: { id: 'u1', name: 'Test User', email: 'u@e.com', role: 'USER' },
        }),
      },
    };
    const limit = vi.fn().mockResolvedValue([
      {
        clientId: 'packrat-claude-mcp',
        name: 'Claude',
        icon: null,
        tos: null,
        policy: null,
        uri: null,
      },
    ]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const db = { select: vi.fn().mockReturnValue({ from }) };
    const schema = { oauthClient: { clientId: 'client_id' } };

    const res = await handleConsentPage(req, {
      auth: auth as never,
      db: db as never,
      schema: schema as never,
    });
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
    const req = new Request(
      'https://api.packrat.world/oauth/consent?client_id=packrat-claude-mcp&scope=mcp%3Aadmin',
    );
    const auth = {
      api: {
        getSession: vi.fn().mockResolvedValue({
          user: { id: 'u1', email: 'admin@e.com', role: 'ADMIN' },
        }),
      },
    };
    const limit = vi.fn().mockResolvedValue([
      {
        clientId: 'packrat-claude-mcp',
        name: 'Claude',
        icon: null,
        tos: null,
        policy: null,
        uri: null,
      },
    ]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const db = { select: vi.fn().mockReturnValue({ from }) };
    const schema = { oauthClient: { clientId: 'client_id' } };

    const res = await handleConsentPage(req, {
      auth: auth as never,
      db: db as never,
      schema: schema as never,
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('value="mcp:admin"');
  });
});
