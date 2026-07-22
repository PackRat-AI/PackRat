import { verifyPassword } from '@better-auth/utils/password';
import { betterFetch } from '@better-fetch/fetch';
import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import * as bcrypt from 'bcryptjs';
import { decodeProtectedHeader, importJWK, importPKCS8, jwtVerify, SignJWT } from 'jose';

// Matches bcrypt hashes ($2a$, $2b$, $2y$) left over from pre-migration auth.
const BCRYPT_HASH_RE = /^\$2[aby]\$/;

export async function verifyPasswordCompat({
  hash,
  password,
}: {
  hash: string;
  password: string;
}): Promise<boolean> {
  if (BCRYPT_HASH_RE.test(hash)) {
    return bcrypt.compare(password, hash);
  }
  return verifyPassword(hash, password);
}

// Apple requires a JWT as the OAuth2 client secret. It is valid for up to
// 6 months, so we regenerate it once per isolate (WeakMap cache in index.ts
// handles the per-request dedup).
// Returns null when Apple credentials are not configured (e.g., in tests).
export async function generateAppleClientSecret(env: ValidatedEnv): Promise<string | null> {
  if (!env.APPLE_PRIVATE_KEY) return null;
  try {
    const privateKey = await importPKCS8(env.APPLE_PRIVATE_KEY, 'ES256');
    const now = Math.floor(Date.now() / 1000);
    return await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: env.APPLE_KEY_ID })
      .setIssuer(env.APPLE_TEAM_ID)
      .setSubject(env.APPLE_CLIENT_ID)
      .setAudience('https://appleid.apple.com')
      .setIssuedAt(now)
      .setExpirationTime(now + 60 * 60 * 24 * 180) // 180 days
      .sign(privateKey);
  } catch (err) {
    console.warn(
      '[auth] Apple client-secret generation failed; web OAuth flow will be unavailable:',
      err,
    );
    return null;
  }
}

// TEMPORARY DEBUG SHIM — Better Auth's built-in apple.verifyIdToken swallows
// the underlying jose error and returns bare `false`, so a failed sign-in only
// ever logs "Invalid id token" with no indication of *why* (bad audience,
// bad issuer, expired, wrong alg, JWKS lookup failure, etc). This mirrors
// that verification exactly but logs the caught error before returning false.
// Remove once the audience mismatch is diagnosed.
export function verifyAppleIdTokenWithLogging(audience: string[]) {
  return async (token: string, nonce?: string | null): Promise<boolean> => {
    try {
      const { kid, alg } = decodeProtectedHeader(token);
      if (!kid || !alg) {
        console.error('[auth][apple-debug] missing kid/alg in protected header', { kid, alg });
        return false;
      }
      const { data } = await betterFetch<{ keys: Array<Record<string, string>> }>(
        'https://appleid.apple.com/auth/keys',
      );
      const jwk = data?.keys?.find((k) => k.kid === kid);
      if (!jwk) {
        console.error('[auth][apple-debug] no matching JWK for kid', { kid });
        return false;
      }
      const key = await importJWK(jwk, jwk.alg);
      const { payload } = await jwtVerify(token, key, {
        algorithms: [alg],
        issuer: 'https://appleid.apple.com',
        audience,
        maxTokenAge: '1h',
      });
      if (nonce && payload.nonce !== nonce) {
        console.error('[auth][apple-debug] nonce mismatch', {
          expected: nonce,
          actual: payload.nonce,
        });
        return false;
      }
      return true;
    } catch (err) {
      console.error('[auth][apple-debug] verifyIdToken failed', {
        audience,
        error: err instanceof Error ? `${err.name}: ${err.message}` : err,
      });
      return false;
    }
  };
}
