/**
 * Live-Worker integration tests for the MCP worker's protected-resource
 * surface after the U3+U4 Better Auth cutover.
 *
 * Scope of the MCP worker is now narrow: it accepts an inbound bearer
 * token on `/mcp`, verifies it via the JWKS published by the API worker
 * (`packages/mcp/src/token-verify.ts`), and either delegates to the
 * Durable Object or returns a 401 with the canonical
 * `WWW-Authenticate: Bearer resource_metadata=..., scope=...` header. The
 * full OAuth state machine — `/authorize`, `/token`, `/register`,
 * consent — is now owned by the API worker and exercised by
 * `packages/api/src/auth/__tests__/`.
 *
 * **Deferred (U17 follow-up):** these tests stay `it.todo` because
 * vitest-pool-workers can't boot the Worker entrypoint without first
 * resolving the `ajv`-in-workerd JSON-loading blocker described in
 * `./well-known.test.ts`. The unit suite already covers every JWT
 * verification branch directly in `../token-verify.test.ts` and the
 * 401 envelope shape in `../metadata.test.ts`; these `it.todo`s preserve
 * the end-to-end contract intent so a reviewer can see what the
 * integration smoke is supposed to prove once the harness unblocks.
 */

import { describe, it } from 'vitest';

describe('protected-resource access on /mcp (integration — deferred per U17 follow-up)', () => {
  it.todo(
    'POST /mcp with a fully-valid JWT (correct iss + aud + signature + scope) ' +
      'delegates to the Durable Object and returns the MCP response',
  );

  it.todo(
    'POST /mcp with an expired JWT returns 401 with WWW-Authenticate ' +
      'containing resource_metadata=... and scope=...',
  );

  it.todo(
    'POST /mcp with a JWT whose audience does not match canonicalResourceUrl ' +
      'returns 401 with the canonical WWW-Authenticate envelope',
  );

  it.todo(
    'POST /mcp with a JWT signed by an unknown key (kid not in JWKS) ' +
      'returns 401 — the JWKS cache must not silently fall back to the local set',
  );

  it.todo(
    'POST /mcp with no Authorization header returns 401 with the canonical ' +
      'WWW-Authenticate envelope (pointing at api.packrat.world as the AS)',
  );
});

describe('scope-gated tool surface on /mcp (integration — deferred per U17 follow-up)', () => {
  it.todo(
    'POST /mcp tools/list with an mcp:read token shows only read tools — ' +
      'no admin tools surface',
  );

  it.todo(
    'POST /mcp tools/list with an mcp:admin token shows the full catalog ' +
      'including destructive admin tools',
  );

  it.todo(
    'POST /mcp tools/call for an admin tool with an mcp:read token returns a ' +
      'forbidden envelope (U8 error shape) — never reaches the API worker',
  );
});
