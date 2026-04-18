/**
 * Apple Sign In token verification using Apple's JWKS endpoint.
 * Performs full OIDC validation: signature, issuer, expiry, and (optionally) audience.
 *
 * Apple's public keys are cached in module-level memory for 1 hour to avoid
 * fetching on every request. A stale cache is invalidated and re-fetched when
 * a token arrives with an unknown kid (which signals a key rotation).
 */

interface AppleJWK {
  kty: string;
  kid: string;
  use: string;
  alg: string;
  n: string;
  e: string;
}

interface ApplePublicKeyCache {
  keys: AppleJWK[];
  fetchedAt: number;
}

export interface AppleTokenPayload {
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  sub: string;
  email?: string;
  email_verified?: boolean | string;
  is_private_email?: boolean | string;
  nonce_supported?: boolean;
}

const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_ISSUER = 'https://appleid.apple.com';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

let appleKeyCache: ApplePublicKeyCache | null = null;

async function fetchApplePublicKeys(): Promise<AppleJWK[]> {
  const now = Date.now();
  if (appleKeyCache && now - appleKeyCache.fetchedAt < CACHE_TTL_MS) {
    return appleKeyCache.keys;
  }

  const response = await fetch(APPLE_JWKS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Apple public keys: ${response.status}`);
  }

  const { keys } = (await response.json()) as { keys: AppleJWK[] };
  appleKeyCache = { keys, fetchedAt: now };
  return keys;
}

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }
  return buffer.buffer;
}

function decodeBase64urlJson<T>(base64url: string): T {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  return JSON.parse(atob(padded)) as T;
}

/**
 * Verify an Apple identity token (Sign in with Apple JWT).
 *
 * Validates:
 * - JWT structure and header
 * - RS256 signature against Apple's published JWKS
 * - Issuer must be `https://appleid.apple.com`
 * - Token must not be expired
 * - Audience (when `expectedAudience` is provided)
 *
 * @param identityToken - The raw JWT string from Apple
 * @param expectedAudience - Optional app bundle ID / service ID for audience validation
 */
export async function verifyAppleToken(
  identityToken: string,
  expectedAudience?: string,
): Promise<AppleTokenPayload> {
  const parts = identityToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT structure');
  }

  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

  const header = decodeBase64urlJson<{ kid?: string; alg?: string }>(headerB64);
  if (!header.kid || !header.alg) {
    throw new Error('Invalid JWT header: missing kid or alg');
  }
  if (header.alg !== 'RS256') {
    throw new Error(`Unsupported algorithm: ${header.alg}`);
  }

  // Find the matching Apple public key; retry once on cache miss (key rotation)
  let keys = await fetchApplePublicKeys();
  let matchedJwk = keys.find((k) => k.kid === header.kid);
  if (!matchedJwk) {
    appleKeyCache = null;
    keys = await fetchApplePublicKeys();
    matchedJwk = keys.find((k) => k.kid === header.kid);
    if (!matchedJwk) {
      throw new Error(`No matching Apple public key found for kid: ${header.kid}`);
    }
  }

  // Import the RSA public key via Web Crypto (available in CF Workers and modern browsers)
  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    matchedJwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  // Verify signature
  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64urlToBuffer(signatureB64);
  const isValid = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    cryptoKey,
    signature,
    signedData,
  );
  if (!isValid) {
    throw new Error('Apple token signature verification failed');
  }

  const payload = decodeBase64urlJson<AppleTokenPayload>(payloadB64);

  if (payload.iss !== APPLE_ISSUER) {
    throw new Error(`Invalid token issuer: ${payload.iss}`);
  }

  if (!payload.exp || Date.now() / 1000 > payload.exp) {
    throw new Error('Apple token has expired');
  }

  if (expectedAudience && payload.aud !== expectedAudience) {
    throw new Error(`Invalid token audience: expected ${expectedAudience}, got ${payload.aud}`);
  }

  return payload;
}

/** Exposed for testing: forcibly clears the in-memory JWKS cache. */
export function clearAppleKeyCache(): void {
  appleKeyCache = null;
}
