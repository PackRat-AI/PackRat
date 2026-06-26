import { createDb } from '@packrat/api/db';
import type { AuthUser } from '@packrat/api/middleware/auth';
import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import { users } from '@packrat/db';
import { isString } from '@packrat/guards';
import { eq } from 'drizzle-orm';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const TRAILING_SLASH = /\/$/;
const BEARER_PREFIX = /^Bearer\s+/i;
const SCOPE_SPLIT = /\s+/;
const MCP_AUDIENCE = 'https://mcp.packratai.com/mcp';
const JWKS_CACHE = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function issuerFromEnv(env: ValidatedEnv): string {
  return env.PACKRAT_API_URL.replace(TRAILING_SLASH, '');
}

function jwksFor(issuer: string): ReturnType<typeof createRemoteJWKSet> {
  const cached = JWKS_CACHE.get(issuer);
  if (cached) return cached;
  const jwks = createRemoteJWKSet(new URL(`${issuer}/api/auth/jwks`), { cacheMaxAge: 60_000 });
  JWKS_CACHE.set(issuer, jwks);
  return jwks;
}

function bearerFrom(request: Request): string | null {
  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.replace(BEARER_PREFIX, '').trim();
  return token && authorization !== token ? token : null;
}

function parseScopes(claim: unknown): string[] {
  if (!isString(claim)) return [];
  const trimmed = claim.trim();
  return trimmed ? trimmed.split(SCOPE_SPLIT) : [];
}

export async function resolveMcpBearerUser({
  env,
  request,
  requireAdminScope = false,
}: {
  env: ValidatedEnv;
  request: Request;
  requireAdminScope?: boolean;
}): Promise<AuthUser | null> {
  const token = bearerFrom(request);
  if (!token) return null;

  let sub = '';
  let scopes: string[] = [];
  try {
    const issuer = issuerFromEnv(env);
    const { payload } = await jwtVerify(token, jwksFor(issuer), {
      issuer,
      audience: MCP_AUDIENCE,
      algorithms: ['ES256', 'RS256'],
    });
    sub = isString(payload.sub) ? payload.sub : '';
    scopes = parseScopes(payload.scope);
  } catch {
    return null;
  }

  if (!sub) return null;
  if (requireAdminScope && !scopes.includes('mcp:admin')) return null;
  if (!requireAdminScope && !scopes.some((scope) => scope.startsWith('mcp'))) return null;

  const db = createDb();
  const userRow = await db
    .select({
      id: users.id,
      role: users.role,
      email: users.email,
      name: users.name,
    })
    .from(users)
    .where(eq(users.id, sub))
    .limit(1);
  const user = userRow[0];
  if (!user) return null;
  if (requireAdminScope && user.role !== 'ADMIN') return null;

  return {
    userId: user.id,
    role: user.role,
    email: user.email,
    name: user.name,
  };
}

export function __resetMcpJwksCacheForTests(): void {
  JWKS_CACHE.clear();
}
