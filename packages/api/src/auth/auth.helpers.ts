import { verifyPassword } from '@better-auth/utils/password';
import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import * as bcrypt from 'bcryptjs';
import { importPKCS8, SignJWT } from 'jose';

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
