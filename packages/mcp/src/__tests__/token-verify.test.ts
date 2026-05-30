/**
 * Unit tests for `verifyMcpToken` (U2 — JWT verification surface).
 *
 * Strategy: spin up an in-memory ES256 keypair via `jose.generateKeyPair`,
 * expose its public JWK through a mocked `globalThis.fetch` so the real
 * `jose.createRemoteJWKSet` flow runs unchanged — this exercises both the
 * verification path AND the cache/fetch behavior end-to-end.
 *
 * For the stale-while-revalidate test we swap the JWKS payload between
 * fetches so the first verification fails (cache holds old key) and the
 * `jwks.reload()` retry succeeds (fresh key).
 */

import { exportJWK, generateKeyPair, type JWK, SignJWT } from 'jose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetJwksCacheForTests, verifyMcpToken } from '../token-verify';
import type { Env } from '../types';

const ISSUER = 'https://api.test.packratai.com';
const AUDIENCE = 'https://mcp.packratai.com/mcp';
const JWKS_URL = `${ISSUER}/api/auth/jwks`;

// Minimal Env stub — the verifier only touches PACKRAT_API_URL. The rest of
// the bindings (Durable Object, KV, rate limit) are irrelevant for this
// unit and casting through `unknown` keeps the structural typing happy.
const env = { PACKRAT_API_URL: ISSUER } as unknown as Env;

// Stub ExecutionContext — `waitUntil` is a no-op for verifier tests.
const ctx = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
} as unknown as ExecutionContext;

// ---------------------------------------------------------------------------
// Keypair + JWKS fixtures
// ---------------------------------------------------------------------------

let privateKey: CryptoKey;
let publicJwk: JWK;
let kid: string;

// A second keypair used for the "unknown key" / SWR test scenarios.
// Only the public JWK is exercised in tests (no signing with the alt
// private key); the keypair generation is kept end-to-end so the JWK shape
// is structurally identical to what Better Auth would publish in prod.
let altPublicJwk: JWK;
let altKid: string;

// Which set of JWKs the mocked fetch currently serves. Mutating this between
// calls lets us model JWKS rotation for the SWR retry test.
let currentJwksKeys: JWK[] = [];

let fetchSpy: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>;

beforeEach(async () => {
  const pair = await generateKeyPair('ES256', { extractable: true });
  privateKey = pair.privateKey;
  publicJwk = await exportJWK(pair.publicKey);
  kid = 'test-key-1';
  publicJwk.kid = kid;
  publicJwk.alg = 'ES256';
  publicJwk.use = 'sig';

  const altPair = await generateKeyPair('ES256', { extractable: true });
  altPublicJwk = await exportJWK(altPair.publicKey);
  altKid = 'test-key-2';
  altPublicJwk.kid = altKid;
  altPublicJwk.alg = 'ES256';
  altPublicJwk.use = 'sig';

  // Default: only the primary key is published.
  currentJwksKeys = [publicJwk];

  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    if (url === JWKS_URL) {
      return new Response(JSON.stringify({ keys: currentJwksKeys }), {
        status: 200,
        headers: { 'Content-Type': 'application/jwk-set+json' },
      });
    }
    throw new Error(`unexpected fetch in test: ${url}`);
  });

  __resetJwksCacheForTests();
});

afterEach(() => {
  fetchSpy.mockRestore();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Token builder helpers
// ---------------------------------------------------------------------------

interface MakeJwtOpts {
  sub?: string;
  scope?: string | undefined;
  iss?: string;
  aud?: string | string[];
  exp?: number | string;
  nbf?: number;
  signingKey?: CryptoKey;
  signingKid?: string;
  alg?: string;
}

async function makeJwt(opts: MakeJwtOpts = {}): Promise<string> {
  const {
    sub = 'user-123',
    scope,
    iss = ISSUER,
    aud = AUDIENCE,
    exp = '1h',
    nbf,
    signingKey = privateKey,
    signingKid = kid,
    alg = 'ES256',
  } = opts;

  const payload: Record<string, unknown> = { sub };
  if (scope !== undefined) payload.scope = scope;
  if (nbf !== undefined) payload.nbf = nbf;

  const jwt = new SignJWT(payload)
    .setProtectedHeader({ alg, kid: signingKid })
    .setIssuedAt()
    .setIssuer(iss)
    .setAudience(aud);

  if (typeof exp === 'string') {
    jwt.setExpirationTime(exp);
  } else {
    jwt.setExpirationTime(exp);
  }

  return jwt.sign(signingKey);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('verifyMcpToken — happy paths', () => {
  it('returns { sub, scopes, token } for a valid ES256 JWT with all claims', async () => {
    const token = await makeJwt({ sub: 'user-abc', scope: 'mcp:read mcp:write' });
    const result = await verifyMcpToken(token, { env, ctx });
    expect(result).not.toBeNull();
    expect(result?.sub).toBe('user-abc');
    expect(result?.scopes).toEqual(['mcp:read', 'mcp:write']);
    expect(result?.token).toBe(token);
  });

  it('splits the scope claim on whitespace, tolerating multiple-space separators', async () => {
    const token = await makeJwt({ scope: 'mcp:read   mcp:write  mcp:admin' });
    const result = await verifyMcpToken(token, { env, ctx });
    expect(result?.scopes).toEqual(['mcp:read', 'mcp:write', 'mcp:admin']);
  });

  it('returns scopes: [] when the JWT has no scope claim', async () => {
    const token = await makeJwt({ scope: undefined });
    const result = await verifyMcpToken(token, { env, ctx });
    expect(result).not.toBeNull();
    expect(result?.scopes).toEqual([]);
  });

  it('returns scopes: [] when the scope claim is an empty string', async () => {
    const token = await makeJwt({ scope: '' });
    const result = await verifyMcpToken(token, { env, ctx });
    expect(result).not.toBeNull();
    expect(result?.scopes).toEqual([]);
  });

  it('accepts a JWT whose aud claim is an array including the MCP audience', async () => {
    const token = await makeJwt({ aud: [AUDIENCE, 'https://other.example/api'] });
    const result = await verifyMcpToken(token, { env, ctx });
    expect(result).not.toBeNull();
    expect(result?.sub).toBe('user-123');
  });

  it('accepts a JWT whose aud claim is an array of one (the MCP audience)', async () => {
    const token = await makeJwt({ aud: [AUDIENCE] });
    const result = await verifyMcpToken(token, { env, ctx });
    expect(result).not.toBeNull();
  });
});

describe('verifyMcpToken — error paths', () => {
  it('returns null for a JWT with the wrong issuer', async () => {
    const token = await makeJwt({ iss: 'https://evil.example' });
    const result = await verifyMcpToken(token, { env, ctx });
    expect(result).toBeNull();
  });

  it('returns null for a JWT with the wrong audience', async () => {
    const token = await makeJwt({ aud: 'https://other-rs.example/api' });
    const result = await verifyMcpToken(token, { env, ctx });
    expect(result).toBeNull();
  });

  it('returns null for an expired JWT', async () => {
    // exp 60s in the past — well past jose's default clock tolerance (0).
    const expSecs = Math.floor(Date.now() / 1000) - 60;
    const token = await makeJwt({ exp: expSecs });
    const result = await verifyMcpToken(token, { env, ctx });
    expect(result).toBeNull();
  });

  it('returns null for a not-yet-valid JWT (nbf in the future)', async () => {
    const nbfSecs = Math.floor(Date.now() / 1000) + 300;
    const token = await makeJwt({ nbf: nbfSecs });
    const result = await verifyMcpToken(token, { env, ctx });
    expect(result).toBeNull();
  });

  it('returns null for a malformed JWT (not three base64 segments)', async () => {
    const result = await verifyMcpToken('not.a.jwt.shape.at.all', { env, ctx });
    expect(result).toBeNull();
  });

  it('returns null for a completely empty token string', async () => {
    const result = await verifyMcpToken('', { env, ctx });
    expect(result).toBeNull();
  });

  it('returns null for a null/undefined token (caller bug — defensive)', async () => {
    const resultUndef = await verifyMcpToken(undefined as any, { env, ctx });
    expect(resultUndef).toBeNull();
    const resultNull = await verifyMcpToken(null as any, { env, ctx });
    expect(resultNull).toBeNull();
  });

  it('returns null for a JWT signed with alg: none (algorithm allowlist enforced)', async () => {
    // Hand-craft an alg:none JWT — `jose.SignJWT` won't sign without a key,
    // so we build the three-segment shape directly.
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: 'user-123',
        iss: ISSUER,
        aud: AUDIENCE,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString('base64url');
    const unsigned = `${header}.${payload}.`;
    const result = await verifyMcpToken(unsigned, { env, ctx });
    expect(result).toBeNull();
  });

  it('returns null when jose.jwtVerify throws unexpectedly (regression guard for better-auth#9654)', async () => {
    // Replace the JWKS-fetch response with malformed JSON so jose throws a
    // non-JWS error during key resolution. This simulates the better-auth#9654
    // class of bug where a verify call throws something other than a normal
    // claim/signature failure.
    fetchSpy.mockResolvedValueOnce(
      new Response('{not valid json', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const token = await makeJwt();
    const result = await verifyMcpToken(token, { env, ctx });
    expect(result).toBeNull();
  });

  it('returns null when the JWT is missing the sub claim (rate-limit/audit key invariant)', async () => {
    // SignJWT lets us omit `sub` — verify catches via the structural check
    // inside verifyOnce, mapped to null by the outer try/catch.
    const jwt = new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid })
      .setIssuedAt()
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime('1h');
    const token = await jwt.sign(privateKey);
    const result = await verifyMcpToken(token, { env, ctx });
    expect(result).toBeNull();
  });
});

describe('verifyMcpToken — stale-while-revalidate', () => {
  it('refetches JWKS once and retries on signature failure when key rotates', async () => {
    // Stage 1: JWKS only contains the alt key (old/stale state from the
    // verifier's perspective). Token is signed with the primary key whose
    // public JWK isn't published yet — first verify fails with
    // JWSSignatureVerificationFailed (or JWKSNoMatchingKey, both trigger
    // the SWR path for missing-kid scenarios — but our retry guard is
    // strictly on signature failure; for missing-kid we still return null
    // since jose throws JWKSNoMatchingKey, not a signature error).
    //
    // To exercise the retry, we use the SAME kid for both keys so the
    // JWKS lookup matches the key but the signature mismatches. Then we
    // rotate the published JWK between the first and second fetch.
    altPublicJwk.kid = kid; // reuse the same kid so kid-match succeeds
    currentJwksKeys = [altPublicJwk]; // wrong public key for the token

    // The token is signed with the PRIMARY private key but claims the kid
    // shared with the alt key — sig check fails on first attempt.
    const token = await makeJwt({ signingKey: privateKey, signingKid: kid });

    // After the first failed fetch, rotate the published JWKS to the
    // correct primary key so `jwks.reload()` picks it up.
    fetchSpy.mockImplementationOnce(async () => {
      // First fetch — serve wrong key.
      return new Response(JSON.stringify({ keys: [altPublicJwk] }), {
        status: 200,
        headers: { 'Content-Type': 'application/jwk-set+json' },
      });
    });
    fetchSpy.mockImplementationOnce(async () => {
      // Reload after signature failure — serve correct key.
      return new Response(JSON.stringify({ keys: [publicJwk] }), {
        status: 200,
        headers: { 'Content-Type': 'application/jwk-set+json' },
      });
    });

    const result = await verifyMcpToken(token, { env, ctx });
    expect(result).not.toBeNull();
    expect(result?.sub).toBe('user-123');
    // Exactly two fetches happened: the initial JWKS load + the forced
    // reload after the signature failure.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('returns null after one retry when JWKS rotation does not surface the right key', async () => {
    // Both fetches return the wrong key — verify fails, reload fails, returns null.
    altPublicJwk.kid = kid;
    fetchSpy.mockImplementation(async () => {
      return new Response(JSON.stringify({ keys: [altPublicJwk] }), {
        status: 200,
        headers: { 'Content-Type': 'application/jwk-set+json' },
      });
    });

    const token = await makeJwt({ signingKey: privateKey, signingKid: kid });
    const result = await verifyMcpToken(token, { env, ctx });
    expect(result).toBeNull();
  });
});

describe('verifyMcpToken — JWKS caching behavior', () => {
  it('fetches JWKS exactly once across two consecutive verifications', async () => {
    const t1 = await makeJwt({ sub: 'user-1' });
    const t2 = await makeJwt({ sub: 'user-2' });

    const r1 = await verifyMcpToken(t1, { env, ctx });
    const r2 = await verifyMcpToken(t2, { env, ctx });

    expect(r1?.sub).toBe('user-1');
    expect(r2?.sub).toBe('user-2');
    // jose's per-isolate JWKS cache means the second verification reuses
    // the first fetch's result — exactly one network call.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
