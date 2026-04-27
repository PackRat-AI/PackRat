import { createDb } from '@packrat/api/db';
import { catalogItems, packs, users } from '@packrat/api/db/schema';
import { verifyCFAccessRequest } from '@packrat/api/middleware/cfAccess';
import { timingSafeEqual } from '@packrat/api/utils/auth';
import { getEnv } from '@packrat/api/utils/env-validation';
import { assertAllDefined } from '@packrat/guards';
import { and, count, desc, eq, ilike, or } from 'drizzle-orm';
import { Elysia, status } from 'elysia';
import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import { analyticsRoutes } from './analytics';

const ADMIN_TOKEN_TTL_SECONDS = 3600; // 1 hour
const ADMIN_JWT_ISSUER = 'packrat-api';
const ADMIN_JWT_AUDIENCE = 'packrat-admin';

function basicAuthGuard(request: Request): { authorized: true } | { authorized: false } {
  const header = request.headers.get('authorization') ?? '';
  if (!header.startsWith('Basic ')) return { authorized: false };
  try {
    const raw = header.slice(6);
    const decoded = atob(raw);
    const sep = decoded.indexOf(':');
    if (sep === -1) return { authorized: false };
    const username = decoded.slice(0, sep);
    const password = decoded.slice(sep + 1);
    const env = getEnv();
    const userOk = timingSafeEqual(username, env.ADMIN_USERNAME);
    const passOk = timingSafeEqual(password, env.ADMIN_PASSWORD);
    if (userOk && passOk) return { authorized: true };
  } catch {
    return { authorized: false };
  }
  return { authorized: false };
}

async function issueAdminJwt(username: string): Promise<string> {
  const env = getEnv();
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(username)
    .setIssuer(ADMIN_JWT_ISSUER)
    .setAudience(ADMIN_JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_TOKEN_TTL_SECONDS}s`)
    .sign(secret);
}

async function verifyAdminJwt(token: string): Promise<boolean> {
  try {
    const env = getEnv();
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, {
      issuer: ADMIN_JWT_ISSUER,
      audience: ADMIN_JWT_AUDIENCE,
    });
    return payload.role === 'admin';
  } catch {
    return false;
  }
}

// Protected routes: Bearer JWT only.
// The JWT is issued by /token, which already enforced both factors (CF JWT + Basic
// in prod, Basic-only in local dev). No need to re-check CF or Basic here.
async function adminAuthGuard(request: Request): Promise<boolean> {
  const env = getEnv();
  const { CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD } = env;
  const header = request.headers.get('authorization') ?? '';

  if (header.startsWith('Bearer ')) return verifyAdminJwt(header.slice(7));

  // Local dev only: allow Basic auth directly on protected routes as a convenience.
  // Both CF vars absent AND non-production environment must hold — missing CF vars
  // alone is not enough so a misconfigured prod cannot fall back to Basic auth.
  if (env.ENVIRONMENT !== 'production' && !CF_ACCESS_TEAM_DOMAIN && !CF_ACCESS_AUD && header.startsWith('Basic ')) {
    return basicAuthGuard(request).authorized;
  }

  return false;
}

// ---------------------------------------------------------------------------

export const adminRoutes = new Elysia({ prefix: '/admin' })
  // Token exchange — must be registered BEFORE the auth guard so the admin
  // SPA can exchange Basic credentials for a short-lived JWT.
  .post(
    '/token',
    async ({ request }) => {
      const env = getEnv();
      if (env.TOKEN_RATE_LIMITER) {
        const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
        const { success } = await env.TOKEN_RATE_LIMITER.limit({ key: ip });
        if (!success) return status(429, { error: 'Too many requests' });
      }

      const { CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD } = env;

      // CF JWT required when: CF vars are set OR running in production.
      // The ENVIRONMENT check is a safety net — missing CF vars in prod must not
      // silently downgrade to Basic-only.
      if (CF_ACCESS_TEAM_DOMAIN && CF_ACCESS_AUD) {
        const cfIdentity = await verifyCFAccessRequest(request, CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD);
        if (!cfIdentity) return status(401, { error: 'CF Access authentication required' });
      } else if (env.ENVIRONMENT === 'production') {
        // CF vars missing but we're in production — refuse rather than fall back.
        return status(503, { error: 'Server misconfiguration: CF Access not configured' });
      }

      const header = request.headers.get('authorization') ?? '';
      if (!header.startsWith('Basic ')) {
        return status(401, { error: 'Missing credentials' });
      }
      const auth = basicAuthGuard(request);
      if (!auth.authorized) return status(401, { error: 'Invalid username or password' });

      const decoded = atob(header.slice(6));
      const sep = decoded.indexOf(':');
      const username = sep >= 0 ? decoded.slice(0, sep) : 'admin';

      const token = await issueAdminJwt(username);
      return { token, expiresIn: ADMIN_TOKEN_TTL_SECONDS };
    },
    {
      detail: {
        tags: ['Admin'],
        summary: 'Exchange Basic credentials for a short-lived admin JWT (CF JWT required in prod)',
      },
    },
  )
  .onBeforeHandle(async ({ request, path }) => {
    if (path === '/api/admin/token') return;
    const ok = await adminAuthGuard(request);
    if (!ok) return status(401, { error: 'Unauthorized' });
  })

  // Stats
  .get(
    '/stats',
    async () => {
      const db = createDb();
      try {
        const [userCount] = await db.select({ count: count() }).from(users);
        const [packCount] = await db
          .select({ count: count() })
          .from(packs)
          .where(eq(packs.deleted, false));
        const [itemCount] = await db.select({ count: count() }).from(catalogItems);

        assertAllDefined([userCount, packCount, itemCount]);

        return {
          users: userCount?.count ?? 0,
          packs: packCount?.count ?? 0,
          items: itemCount?.count ?? 0,
        };
      } catch (error) {
        console.error('Error fetching stats:', error);
        return status(500, { error: 'Failed to fetch stats', code: 'STATS_ERROR' });
      }
    },
    {
      detail: { tags: ['Admin'], summary: 'Get admin dashboard statistics' },
    },
  )

  // Users list
  .get(
    '/users-list',
    async ({ query }) => {
      const db = createDb();
      try {
        const limit = Number(query.limit ?? 100);
        const offset = Number(query.offset ?? 0);
        const search = query.q;
        const usersList = await db
          .select({
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            role: users.role,
            emailVerified: users.emailVerified,
            createdAt: users.createdAt,
          })
          .from(users)
          .where(
            search
              ? or(
                  ilike(users.email, `%${search}%`),
                  ilike(users.firstName, `%${search}%`),
                  ilike(users.lastName, `%${search}%`),
                )
              : undefined,
          )
          .orderBy(desc(users.createdAt))
          .limit(limit)
          .offset(offset);

        return usersList.map((u) => ({
          ...u,
          createdAt: u.createdAt?.toISOString() || null,
        }));
      } catch (error) {
        console.error('Error fetching users:', error);
        return status(500, { error: 'Failed to fetch users', code: 'USERS_FETCH_ERROR' });
      }
    },
    {
      query: z.object({
        limit: z.coerce.number().int().positive().max(100).optional(),
        offset: z.coerce.number().int().min(0).optional(),
        q: z.string().optional(),
      }),
      detail: { tags: ['Admin'], summary: 'List users' },
    },
  )

  // Packs list
  .get(
    '/packs-list',
    async ({ query }) => {
      const db = createDb();
      try {
        const limit = Number(query.limit ?? 100);
        const offset = Number(query.offset ?? 0);
        const search = query.q;
        const packsList = await db
          .select({
            id: packs.id,
            name: packs.name,
            description: packs.description,
            category: packs.category,
            isPublic: packs.isPublic,
            createdAt: packs.createdAt,
            userEmail: users.email,
          })
          .from(packs)
          .leftJoin(users, eq(packs.userId, users.id))
          .where(
            and(
              eq(packs.deleted, false),
              search
                ? or(
                    ilike(packs.name, `%${search}%`),
                    ilike(packs.description, `%${search}%`),
                    ilike(packs.category, `%${search}%`),
                    ilike(users.email, `%${search}%`),
                  )
                : undefined,
            ),
          )
          .orderBy(desc(packs.createdAt))
          .limit(limit)
          .offset(offset);

        return packsList.map((p) => ({
          ...p,
          createdAt: p.createdAt?.toISOString() || null,
        }));
      } catch (error) {
        console.error('Error fetching packs:', error);
        return status(500, { error: 'Failed to fetch packs', code: 'PACKS_FETCH_ERROR' });
      }
    },
    {
      query: z.object({
        limit: z.coerce.number().int().positive().max(100).optional(),
        offset: z.coerce.number().int().min(0).optional(),
        q: z.string().optional(),
      }),
      detail: { tags: ['Admin'], summary: 'List packs' },
    },
  )

  // Catalog items list
  .get(
    '/catalog-list',
    async ({ query }) => {
      const db = createDb();
      try {
        const limit = Number(query.limit ?? 25);
        const offset = Number(query.offset ?? 0);
        const search = query.q;
        const itemsList = await db
          .select({
            id: catalogItems.id,
            name: catalogItems.name,
            categories: catalogItems.categories,
            brand: catalogItems.brand,
            price: catalogItems.price,
            weight: catalogItems.weight,
            weightUnit: catalogItems.weightUnit,
            createdAt: catalogItems.createdAt,
          })
          .from(catalogItems)
          .where(
            search
              ? or(
                  ilike(catalogItems.name, `%${search}%`),
                  ilike(catalogItems.brand, `%${search}%`),
                  ilike(catalogItems.description, `%${search}%`),
                )
              : undefined,
          )
          .orderBy(desc(catalogItems.id))
          .limit(limit)
          .offset(offset);

        return itemsList.map((it) => ({
          ...it,
          createdAt: it.createdAt?.toISOString() || null,
        }));
      } catch (error) {
        console.error('Error fetching catalog items:', error);
        return status(500, { error: 'Failed to fetch catalog items', code: 'CATALOG_FETCH_ERROR' });
      }
    },
    {
      query: z.object({
        limit: z.coerce.number().int().positive().max(100).optional(),
        offset: z.coerce.number().int().min(0).optional(),
        q: z.string().optional(),
      }),
      detail: { tags: ['Admin'], summary: 'List catalog items' },
    },
  )

  // Delete a user
  .delete(
    '/users/:id',
    async ({ params }) => {
      const id = Number(params.id);
      if (!Number.isFinite(id) || id <= 0) return status(400, { error: 'Invalid user id' });
      const db = createDb();
      try {
        const deleted = await db.delete(users).where(eq(users.id, id)).returning();
        if (!deleted.length) return status(404, { error: 'User not found' });
        return { success: true as const };
      } catch (error) {
        if ((error as { code?: string })?.code === '23503') {
          return status(409, { error: 'Cannot delete: user has dependent data' });
        }
        console.error('Error deleting user:', error);
        return status(500, { error: 'Failed to delete user' });
      }
    },
    {
      params: z.object({ id: z.string() }),
      detail: { tags: ['Admin'], summary: 'Delete a user' },
    },
  )

  // Soft-delete a pack
  .delete(
    '/packs/:id',
    async ({ params }) => {
      const db = createDb();
      try {
        const updated = await db
          .update(packs)
          .set({ deleted: true })
          .where(and(eq(packs.id, params.id), eq(packs.deleted, false)))
          .returning();
        if (!updated.length) return status(404, { error: 'Pack not found' });
        return { success: true as const };
      } catch (error) {
        console.error('Error deleting pack:', error);
        return status(500, { error: 'Failed to delete pack' });
      }
    },
    {
      params: z.object({ id: z.string() }),
      detail: { tags: ['Admin'], summary: 'Soft-delete a pack' },
    },
  )

  // Delete a catalog item
  .delete(
    '/catalog/:id',
    async ({ params }) => {
      const id = Number(params.id);
      if (!Number.isFinite(id) || id <= 0) return status(400, { error: 'Invalid catalog item id' });
      const db = createDb();
      try {
        const deleted = await db.delete(catalogItems).where(eq(catalogItems.id, id)).returning();
        if (!deleted.length) return status(404, { error: 'Catalog item not found' });
        return { success: true as const };
      } catch (error) {
        if ((error as { code?: string })?.code === '23503') {
          return status(409, { error: 'Cannot delete: item has dependent data' });
        }
        console.error('Error deleting catalog item:', error);
        return status(500, { error: 'Failed to delete catalog item' });
      }
    },
    {
      params: z.object({ id: z.string() }),
      detail: { tags: ['Admin'], summary: 'Delete a catalog item' },
    },
  )

  // Update a catalog item
  .patch(
    '/catalog/:id',
    async ({ params, body }) => {
      const id = Number(params.id);
      if (!Number.isFinite(id) || id <= 0) return status(400, { error: 'Invalid catalog item id' });
      const db = createDb();
      try {
        const updated = await db
          .update(catalogItems)
          .set({
            updatedAt: new Date(),
            ...(body.name !== undefined && { name: body.name }),
            ...(body.brand !== undefined && { brand: body.brand }),
            ...(body.categories !== undefined && { categories: body.categories }),
            ...(body.weight !== undefined && { weight: body.weight }),
            ...(body.weightUnit !== undefined && {
              weightUnit: body.weightUnit as 'g' | 'oz' | 'kg' | 'lb',
            }),
            ...(body.price !== undefined && { price: body.price }),
            ...(body.description !== undefined && { description: body.description }),
          })
          .where(eq(catalogItems.id, id))
          .returning();
        const first = updated[0];
        if (!first) return status(404, { error: 'Catalog item not found' });
        return { id: first.id, name: first.name };
      } catch (error) {
        console.error('Error updating catalog item:', error);
        return status(500, { error: 'Failed to update catalog item' });
      }
    },
    {
      params: z.object({ id: z.string() }),
      body: z.object({
        name: z.string().min(1).optional(),
        brand: z.string().nullable().optional(),
        categories: z.array(z.string()).nullable().optional(),
        weight: z.number().optional(),
        weightUnit: z.string().optional(),
        price: z.number().nullable().optional(),
        description: z.string().nullable().optional(),
      }),
      detail: { tags: ['Admin'], summary: 'Update a catalog item' },
    },
  )
  .use(analyticsRoutes);
