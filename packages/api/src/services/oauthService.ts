/**
 * OAuth 2.1 service — stateless helpers that operate on the database.
 *
 * All functions accept an explicit `db` instance so they are easily unit-tested
 * without needing a Hono context.
 */

import { randomBytes } from 'node:crypto';
import {
  oauthAccessTokens,
  oauthAuthorizationCodes,
  oauthClients,
  oauthDeviceCodes,
  users,
} from '@packrat/api/db/schema';
import {
  ACCESS_TOKEN_TTL_MS,
  AUTH_CODE_TTL_MS,
  DEVICE_CODE_TTL_MS,
  DEVICE_POLL_INTERVAL,
} from '@packrat/api/schemas/oauth';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { createDb } from '../db';

export type Db = ReturnType<typeof createDb>;

// ── Token / code generation ───────────────────────────────────────────────────

/** Opaque OAuth access token with `oa_` prefix. */
export function generateOAuthToken(): string {
  return `oa_${randomBytes(32).toString('hex')}`;
}

/** Random opaque device_code (64 hex chars). */
export function generateDeviceCode(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Short human-readable user_code: `XXXX-XXXX` using uppercase letters and
 * digits that are hard to confuse (no O/0/1/I/L).
 */
export function generateUserCode(): string {
  const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = Array.from(randomBytes(8));
  const chars = bytes.map((b) => CHARS[b % CHARS.length] ?? CHARS[0]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}

/** Random authorization code (40 hex chars). */
export function generateAuthCode(): string {
  return randomBytes(20).toString('hex');
}

// ── PKCE ─────────────────────────────────────────────────────────────────────

/**
 * Verify a PKCE S256 code_challenge against a code_verifier.
 * Uses the Web Crypto API (available in all modern runtimes, including Workers).
 */
export async function verifyPKCEChallenge(verifier: string, challenge: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  // Base64url-encode without padding
  const base64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
  const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return base64url === challenge;
}

// ── Client lookup ─────────────────────────────────────────────────────────────

export interface ClientRecord {
  id: string;
  name: string;
  secret: string | null;
  redirectUris: string[];
  grants: string[];
  scopes: string[];
  isPublic: boolean;
}

export async function findClient(db: Db, clientId: string): Promise<ClientRecord | null> {
  const [row] = await db
    .select()
    .from(oauthClients)
    .where(eq(oauthClients.id, clientId))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    secret: row.secret,
    redirectUris: (row.redirectUris as string[]) ?? [],
    grants: (row.grants as string[]) ?? [],
    scopes: (row.scopes as string[]) ?? [],
    isPublic: row.isPublic,
  };
}

// ── Authorization Code (PKCE flow) ────────────────────────────────────────────

export interface CreateAuthCodeParams {
  clientId: string;
  userId: number;
  redirectUri: string;
  scope: string;
  codeChallenge: string;
  codeChallengeMethod: string;
}

export async function createAuthorizationCode(
  db: Db,
  params: CreateAuthCodeParams,
): Promise<string> {
  const code = generateAuthCode();
  await db.insert(oauthAuthorizationCodes).values({
    code,
    clientId: params.clientId,
    userId: params.userId,
    redirectUri: params.redirectUri,
    scope: params.scope,
    codeChallenge: params.codeChallenge,
    codeChallengeMethod: params.codeChallengeMethod,
    expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
  });
  return code;
}

export interface ConsumeAuthCodeParams {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}

export interface ConsumedAuthCode {
  userId: number;
  scope: string;
}

/**
 * Validate and consume an authorization code.
 * Returns the associated userId and scope, or null on any failure.
 * Once consumed the code is marked `used_at` to prevent replay.
 */
export async function consumeAuthorizationCode(
  db: Db,
  params: ConsumeAuthCodeParams,
): Promise<ConsumedAuthCode | null> {
  const now = new Date();
  const [row] = await db
    .select()
    .from(oauthAuthorizationCodes)
    .where(
      and(
        eq(oauthAuthorizationCodes.code, params.code),
        eq(oauthAuthorizationCodes.clientId, params.clientId),
        eq(oauthAuthorizationCodes.redirectUri, params.redirectUri),
        isNull(oauthAuthorizationCodes.usedAt),
        gt(oauthAuthorizationCodes.expiresAt, now),
      ),
    )
    .limit(1);

  if (!row) return null;

  const valid = await verifyPKCEChallenge(params.codeVerifier, row.codeChallenge);
  if (!valid) return null;

  // Mark as used (single-use)
  await db
    .update(oauthAuthorizationCodes)
    .set({ usedAt: now })
    .where(eq(oauthAuthorizationCodes.id, row.id));

  return { userId: row.userId, scope: row.scope };
}

// ── Access Tokens ─────────────────────────────────────────────────────────────

export interface CreateAccessTokenParams {
  clientId: string;
  userId: number;
  scope: string;
}

export interface AccessTokenRow {
  token: string;
  expiresIn: number;
}

export async function createAccessToken(
  db: Db,
  params: CreateAccessTokenParams,
): Promise<AccessTokenRow> {
  const token = generateOAuthToken();
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);
  await db.insert(oauthAccessTokens).values({
    token,
    clientId: params.clientId,
    userId: params.userId,
    scope: params.scope,
    expiresAt,
  });
  return { token, expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000) };
}

export interface ValidatedToken {
  userId: number;
  role: string;
  scope: string;
  clientId: string;
}

/**
 * Validate an opaque OAuth access token.
 * Returns user+scope details, or null if the token is missing, expired, or revoked.
 */
export async function validateAccessToken(db: Db, token: string): Promise<ValidatedToken | null> {
  const now = new Date();
  const rows = await db
    .select({
      userId: oauthAccessTokens.userId,
      scope: oauthAccessTokens.scope,
      clientId: oauthAccessTokens.clientId,
      expiresAt: oauthAccessTokens.expiresAt,
      revokedAt: oauthAccessTokens.revokedAt,
      role: users.role,
    })
    .from(oauthAccessTokens)
    .innerJoin(users, eq(oauthAccessTokens.userId, users.id))
    .where(
      and(eq(oauthAccessTokens.token, token), isNull(oauthAccessTokens.revokedAt), gt(oauthAccessTokens.expiresAt, now)),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    userId: row.userId,
    role: row.role ?? 'USER',
    scope: row.scope,
    clientId: row.clientId,
  };
}

/** Revoke an access token by token string. */
export async function revokeAccessToken(db: Db, token: string): Promise<void> {
  await db
    .update(oauthAccessTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(oauthAccessTokens.token, token), isNull(oauthAccessTokens.revokedAt)));
}

// ── Device Authorization Grant ────────────────────────────────────────────────

export interface CreateDeviceCodeParams {
  clientId: string;
  scope: string;
}

export interface DeviceCodeRow {
  deviceCode: string;
  userCode: string;
  expiresIn: number;
  interval: number;
}

export async function createDeviceCode(
  db: Db,
  params: CreateDeviceCodeParams,
): Promise<DeviceCodeRow> {
  const deviceCode = generateDeviceCode();
  const userCode = generateUserCode();
  const expiresAt = new Date(Date.now() + DEVICE_CODE_TTL_MS);
  await db.insert(oauthDeviceCodes).values({
    deviceCode,
    userCode,
    clientId: params.clientId,
    scope: params.scope,
    expiresAt,
    interval: DEVICE_POLL_INTERVAL,
  });
  return {
    deviceCode,
    userCode,
    expiresIn: Math.floor(DEVICE_CODE_TTL_MS / 1000),
    interval: DEVICE_POLL_INTERVAL,
  };
}

/** Mark a device code as verified by the user (stores userId on the record). */
export async function activateDeviceCode(db: Db, params: {
  userCode: string;
  userId: number;
}): Promise<boolean> {
  const now = new Date();
  const [row] = await db
    .select()
    .from(oauthDeviceCodes)
    .where(
      and(
        eq(oauthDeviceCodes.userCode, params.userCode),
        isNull(oauthDeviceCodes.verifiedAt),
        gt(oauthDeviceCodes.expiresAt, now),
      ),
    )
    .limit(1);

  if (!row) return false;

  await db
    .update(oauthDeviceCodes)
    .set({ userId: params.userId, verifiedAt: now })
    .where(eq(oauthDeviceCodes.id, row.id));

  return true;
}

export type PollDeviceCodeResult =
  | { status: 'authorized'; userId: number; scope: string; clientId: string }
  | { status: 'pending' }
  | { status: 'expired' };

/**
 * Poll the device code status.
 * Returns `authorized` (and creates an access token) when the user has approved,
 * `pending` while waiting, or `expired` when the code TTL has elapsed.
 */
export async function pollDeviceCode(
  db: Db,
  params: { deviceCode: string; clientId: string },
): Promise<PollDeviceCodeResult> {
  const now = new Date();
  const [row] = await db
    .select()
    .from(oauthDeviceCodes)
    .where(
      and(
        eq(oauthDeviceCodes.deviceCode, params.deviceCode),
        eq(oauthDeviceCodes.clientId, params.clientId),
      ),
    )
    .limit(1);

  if (!row) return { status: 'expired' };
  if (now > row.expiresAt) return { status: 'expired' };
  if (!row.verifiedAt || row.userId === null) return { status: 'pending' };

  const userId = row.userId;
  if (userId === null) return { status: 'pending' };

  // Delete the device code so it can't be polled again
  await db.delete(oauthDeviceCodes).where(eq(oauthDeviceCodes.id, row.id));

  return {
    status: 'authorized',
    userId,
    scope: row.scope,
    clientId: row.clientId,
  };
}

// ── Introspection ─────────────────────────────────────────────────────────────

export interface IntrospectionResult {
  active: boolean;
  scope?: string;
  clientId?: string;
  sub?: string;
  exp?: number;
  iat?: number;
}

export async function introspectToken(db: Db, token: string): Promise<IntrospectionResult> {
  const [row] = await db
    .select()
    .from(oauthAccessTokens)
    .where(and(eq(oauthAccessTokens.token, token), isNull(oauthAccessTokens.revokedAt)))
    .limit(1);

  if (!row) return { active: false };

  const now = new Date();
  if (now > row.expiresAt) return { active: false };

  return {
    active: true,
    scope: row.scope,
    clientId: row.clientId,
    sub: String(row.userId),
    exp: Math.floor(row.expiresAt.getTime() / 1000),
    iat: Math.floor(row.createdAt.getTime() / 1000),
  };
}
