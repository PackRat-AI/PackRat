/**
 * Live-Worker integration tests for the end-to-end OAuth happy path and
 * the U5 scope-gated `tools/list` surface.
 *
 * Deferred to a follow-up unit: every test in this file requires a
 * mocked Better Auth backend (the `/callback` handler in
 * `packages/mcp/src/auth.ts` POSTs the IdP code to
 * `${PACKRAT_API_URL}/auth/oauth-callback`). Wiring the mock so the
 * exchange returns a synthetic Better Auth session token (and the
 * Worker's downstream tool-call uses that token to authorise) needs
 * fetch interception + a fixture for the PackRat-side user-info
 * endpoint that the props builder reads. That's a meaningful chunk of
 * scaffolding for tests that the unit suite already covers at the
 * function-boundary level — and the test the catalog cares most about
 * (DCR gate + scope-disabled tools) is already covered by
 * `dcr-gate.test.ts` and `../scopes.test.ts` respectively.
 *
 * Leaving as `it.todo` so the contract stays visible.
 */

import { describe, it } from 'vitest';

describe('OAuth happy path (integration — deferred)', () => {
  it.todo(
    'GET /authorize → renders the branded login page (U11) with a valid CSRF nonce ' +
      'and the requested scopes echoed back',
  );

  it.todo('POST /login with valid credentials → 302 to the IdP callback with state preserved');

  it.todo(
    'GET /callback?code=...&state=... exchanges the code with Better Auth ' +
      'and issues an access token bound to the requested scopes',
  );

  it.todo('POST /token with the issued refresh token rotates it (OAuth 2.1 §4.3.1)');
});

describe('scope-gated tool surface (integration — deferred)', () => {
  it.todo(
    'POST /mcp tools/list with an mcp:read-only token shows only read tools — ' +
      'no admin tools surface',
  );

  it.todo(
    'POST /mcp tools/list with an mcp:admin token shows the full catalog including ' +
      'destructive admin tools',
  );

  it.todo(
    'POST /mcp tools/call for an admin tool with an mcp:read-only token returns a ' +
      'rate_limited/forbidden envelope (U8 error shape)',
  );
});
