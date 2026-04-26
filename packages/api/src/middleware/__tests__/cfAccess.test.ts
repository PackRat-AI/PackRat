/**
 * Unit tests for verifyCFAccessRequest.
 *
 * jose's createRemoteJWKSet fetches keys over the network. We replace it with
 * createLocalJWKSet backed by an in-process RSA keypair so verification works
 * without any real network call.
 *
 * Strategy: vi.mock('jose') replaces createRemoteJWKSet with a function that
 * reads a global localJwks reference at call time. beforeAll generates the
 * trusted keypair, exports the public JWK, and stores a createLocalJWKSet
 * keyset in that global. Tests then call verifyCFAccessRequest directly.
 */
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWTPayload,
  type KeyLike,
  SignJWT,
} from 'jose';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock jose before cfAccess.ts is loaded so createRemoteJWKSet is intercepted.
// ---------------------------------------------------------------------------
vi.mock('jose', async (importOriginal) => {
  const original = await importOriginal<typeof import('jose')>();

  return {
    ...original,
    // Replace the remote JWKS factory with one that reads a test-controlled
    // keyset from globalThis. The singleton inside cfAccess.ts calls this
    // once per unique teamDomain, so the same keyset is reused across all
    // tests in this file.
    createRemoteJWKSet: vi.fn(() => {
      return async (protectedHeader: unknown, token: unknown) => {
        const fn = (
          globalThis as unknown as { __cfAccessLocalJwks?: ReturnType<typeof createLocalJWKSet> }
        ).__cfAccessLocalJwks;
        if (!fn) throw new Error('__cfAccessLocalJwks not set — call beforeAll first');
        return fn(protectedHeader as never, token as never);
      };
    }),
  };
});

// ---------------------------------------------------------------------------
// Module under test — imported after the mock is registered.
// ---------------------------------------------------------------------------
import { verifyCFAccessRequest } from '../cfAccess';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TEAM_DOMAIN = 'https://example.cloudflareaccess.com';
const AUD = 'test-audience-tag';

// ---------------------------------------------------------------------------
// Keypair state shared across tests.
// ---------------------------------------------------------------------------
let privateKey: KeyLike;
let untrustedPrivateKey: KeyLike;

beforeAll(async () => {
  // Generate the trusted keypair and wire it up as the local JWKS.
  const trustedPair = await generateKeyPair('RS256');
  privateKey = trustedPair.privateKey;

  const jwk = await exportJWK(trustedPair.publicKey);
  (
    globalThis as unknown as { __cfAccessLocalJwks?: ReturnType<typeof createLocalJWKSet> }
  ).__cfAccessLocalJwks = createLocalJWKSet({ keys: [{ ...jwk, use: 'sig' }] });

  // Untrusted keypair — NOT added to the local JWKS.
  const untrustedPair = await generateKeyPair('RS256');
  untrustedPrivateKey = untrustedPair.privateKey;
});

// ---------------------------------------------------------------------------
// JWT builder
// ---------------------------------------------------------------------------
async function makeCFJwt(opts: {
  email?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  privateKey: KeyLike;
  omitEmail?: boolean;
}): Promise<string> {
  const {
    email = 'admin@example.com',
    iss = TEAM_DOMAIN,
    aud = AUD,
    exp,
    privateKey: signingKey,
    omitEmail = false,
  } = opts;

  const payload: Record<string, unknown> = omitEmail ? {} : { email };

  const jwt = new SignJWT(payload as JWTPayload)
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setIssuer(iss)
    .setAudience(aud);

  if (exp !== undefined) {
    jwt.setExpirationTime(exp);
  } else {
    jwt.setExpirationTime('1h');
  }

  return jwt.sign(signingKey);
}

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://example.com/api/admin', { headers });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('verifyCFAccessRequest', () => {
  it('returns { email } for a valid RS256 JWT with correct iss + aud', async () => {
    const token = await makeCFJwt({ privateKey });
    const result = await verifyCFAccessRequest(
      makeRequest({ 'cf-access-jwt-assertion': token }),
      TEAM_DOMAIN,
      AUD,
    );
    expect(result).toEqual({ email: 'admin@example.com' });
  });

  it('returns null when the cf-access-jwt-assertion header is absent', async () => {
    const result = await verifyCFAccessRequest(makeRequest(), TEAM_DOMAIN, AUD);
    expect(result).toBeNull();
  });

  it('returns null for a JWT with a wrong audience', async () => {
    const token = await makeCFJwt({ privateKey, aud: 'wrong-audience' });
    const result = await verifyCFAccessRequest(
      makeRequest({ 'cf-access-jwt-assertion': token }),
      TEAM_DOMAIN,
      AUD,
    );
    expect(result).toBeNull();
  });

  it('returns null for a JWT with a wrong issuer', async () => {
    const token = await makeCFJwt({ privateKey, iss: 'https://attacker.cloudflareaccess.com' });
    const result = await verifyCFAccessRequest(
      makeRequest({ 'cf-access-jwt-assertion': token }),
      TEAM_DOMAIN,
      AUD,
    );
    expect(result).toBeNull();
  });

  it('returns null for a JWT signed by an untrusted key', async () => {
    const token = await makeCFJwt({ privateKey: untrustedPrivateKey });
    const result = await verifyCFAccessRequest(
      makeRequest({ 'cf-access-jwt-assertion': token }),
      TEAM_DOMAIN,
      AUD,
    );
    expect(result).toBeNull();
  });

  it('returns null when the JWT payload is missing the email field', async () => {
    const token = await makeCFJwt({ privateKey, omitEmail: true });
    const result = await verifyCFAccessRequest(
      makeRequest({ 'cf-access-jwt-assertion': token }),
      TEAM_DOMAIN,
      AUD,
    );
    expect(result).toBeNull();
  });

  it('returns null when the JWT payload has an empty string email', async () => {
    const token = await makeCFJwt({ privateKey, email: '' });
    const result = await verifyCFAccessRequest(
      makeRequest({ 'cf-access-jwt-assertion': token }),
      TEAM_DOMAIN,
      AUD,
    );
    expect(result).toBeNull();
  });

  it('returns null when only CF-Access-Authenticated-User-Email header is present (old spoofable vector)', async () => {
    // The pre-PR code trusted this header directly. The new code requires a
    // cryptographically verified JWT in cf-access-jwt-assertion.
    const result = await verifyCFAccessRequest(
      makeRequest({ 'cf-access-authenticated-user-email': 'admin@example.com' }),
      TEAM_DOMAIN,
      AUD,
    );
    expect(result).toBeNull();
  });
});
