import { getEnv } from '@packrat/api/utils/env-validation';
import * as bcrypt from 'bcryptjs';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Constant-time string comparison. Compares byte-by-byte after
 * length-equalizing the two inputs so neither the match result nor the
 * length difference can be inferred from response timing.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  const len = Math.max(ab.byteLength, bb.byteLength);
  let diff = ab.byteLength ^ bb.byteLength;
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

export function isValidApiKey(headers: Headers | Record<string, string | undefined>): boolean {
  let apiKeyHeader: string | undefined | null;
  if (headers instanceof Headers) {
    apiKeyHeader = headers.get('x-api-key');
  } else {
    apiKeyHeader = headers['x-api-key'] ?? headers['X-API-Key'];
  }
  if (!apiKeyHeader) return false;
  const { PACKRAT_API_KEY } = getEnv();
  if (!PACKRAT_API_KEY) return false;
  return timingSafeEqual(apiKeyHeader, PACKRAT_API_KEY);
}
