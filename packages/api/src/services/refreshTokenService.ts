import type { createDb } from '@packrat/api/db';
import { refreshTokens } from '@packrat/api/db/schema';
import { generateRefreshToken } from '@packrat/api/utils/auth';
import { getEnv } from '@packrat/api/utils/env-validation';
import { and, eq, isNull, or, type SQL } from 'drizzle-orm';

/**
 * Refresh-token persistence layer.
 *
 * Tokens are stored as HMAC-SHA256(raw, REFRESH_TOKEN_PEPPER) in the
 * `refresh_tokens.token` column when the pepper is configured. During the
 * rollout window, reads accept either the hashed form or the legacy
 * plaintext form so existing sessions keep working until they expire.
 *
 * When `REFRESH_TOKEN_PEPPER` is not set, behavior falls back to plaintext
 * storage so dev/test environments without a pepper still function.
 */

type Db = ReturnType<typeof createDb>;

export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const refreshTokenExpiry = () => new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

async function hmacSha256Hex(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data));
  const bytes = new Uint8Array(sig);
  let hex = '';
  for (let i = 0; i < bytes.byteLength; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

/** Hash a raw refresh token for storage. Returns raw when pepper is unset. */
export async function hashRefreshToken(raw: string): Promise<string> {
  const { REFRESH_TOKEN_PEPPER } = getEnv();
  if (!REFRESH_TOKEN_PEPPER) return raw;
  return hmacSha256Hex(REFRESH_TOKEN_PEPPER, raw);
}

/**
 * WHERE-clause builder that matches either the hashed form or the legacy
 * plaintext value. Use this on every query keyed by a raw refresh token so
 * that rotation from plaintext → hashed storage is a hot upgrade.
 */
async function tokenMatchClause(raw: string): Promise<SQL> {
  const hashed = await hashRefreshToken(raw);
  if (hashed === raw) return eq(refreshTokens.token, raw);
  return or(eq(refreshTokens.token, hashed), eq(refreshTokens.token, raw)) as SQL;
}

/**
 * Insert a freshly-generated refresh token and return the **raw** value for
 * the client response. The database row holds only the hashed form when a
 * pepper is configured.
 */
export async function issueRefreshToken(
  db: Db,
  params: { userId: number; expiresAt?: Date },
): Promise<string> {
  const raw = generateRefreshToken();
  const stored = await hashRefreshToken(raw);
  await db.insert(refreshTokens).values({
    userId: params.userId,
    token: stored,
    expiresAt: params.expiresAt ?? refreshTokenExpiry(),
  });
  return raw;
}

/**
 * Fetch a refresh-token row by raw value, INCLUDING revoked rows. Callers
 * need the record even when revoked to detect replay.
 */
export async function findRefreshToken(db: Db, raw: string) {
  const clause = await tokenMatchClause(raw);
  const [row] = await db
    .select({
      id: refreshTokens.id,
      userId: refreshTokens.userId,
      expiresAt: refreshTokens.expiresAt,
      revokedAt: refreshTokens.revokedAt,
      replacedByToken: refreshTokens.replacedByToken,
    })
    .from(refreshTokens)
    .where(clause)
    .limit(1);
  return row;
}

/**
 * Revoke the entire descendant chain of a refresh token. Used when a
 * previously-revoked token is presented again (replay) — the safest response
 * is to kill every token in the lineage so the attacker (or the confused
 * client) is forced back through full auth.
 */
export async function revokeTokenFamily(db: Db, startToken: string): Promise<void> {
  const now = new Date();
  const visited = new Set<string>();
  let current: string | null = startToken;
  while (current && !visited.has(current)) {
    visited.add(current);
    const clause = await tokenMatchClause(current);
    const [row] = await db
      .select({ replacedByToken: refreshTokens.replacedByToken })
      .from(refreshTokens)
      .where(clause)
      .limit(1);
    await db.update(refreshTokens).set({ revokedAt: now }).where(clause);
    current = row?.replacedByToken ?? null;
  }
}

/**
 * Revoke a single refresh token (logout path). Idempotent.
 */
export async function revokeRefreshToken(db: Db, raw: string): Promise<void> {
  const clause = await tokenMatchClause(raw);
  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(clause);
}

/**
 * Revoke a specific token row by id, set its `replacedByToken` to the HASHED
 * successor. Used inside the rotation transaction so the lineage is
 * reconstructable when checking for replay.
 */
export async function markRotated(
  db: Db,
  params: { id: number; replacedByRawToken: string },
): Promise<void> {
  const replacedByStored = await hashRefreshToken(params.replacedByRawToken);
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date(), replacedByToken: replacedByStored })
    .where(eq(refreshTokens.id, params.id));
}

/**
 * Atomically rotate a refresh token: revoke the presented row, link its
 * `replacedByToken` to the hashed successor, and insert the new row — all
 * in a single transaction. Returns the raw successor for the client.
 */
export async function rotateRefreshToken(
  db: Db,
  params: { oldId: number; userId: number; expiresAt?: Date },
): Promise<string> {
  return db.transaction(async (tx) => {
    const fresh = generateRefreshToken();
    const stored = await hashRefreshToken(fresh);
    const now = new Date();
    await tx
      .update(refreshTokens)
      .set({ revokedAt: now, replacedByToken: stored })
      .where(eq(refreshTokens.id, params.oldId));
    await tx.insert(refreshTokens).values({
      userId: params.userId,
      token: stored,
      expiresAt: params.expiresAt ?? refreshTokenExpiry(),
    });
    return fresh;
  });
}

/** Active-and-unrevoked clause for existing plaintext-style `.where` uses. */
export async function activeTokenClause(raw: string): Promise<SQL> {
  const match = await tokenMatchClause(raw);
  return and(match, isNull(refreshTokens.revokedAt)) as SQL;
}
