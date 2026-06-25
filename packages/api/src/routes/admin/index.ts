import { cors } from '@elysiajs/cors';
import { createDb } from '@packrat/api/db';
import { verifyCFAccessRequest } from '@packrat/api/middleware/cfAccess';
import { timingSafeEqual } from '@packrat/api/utils/auth';
import { getEnv } from '@packrat/api/utils/env-validation';
import { catalogItems, packs, users } from '@packrat/db';
import { assertAllDefined, queryBoolean } from '@packrat/guards';
import {
  AdminCatalogListSchema,
  AdminErrorResponses,
  AdminPacksListSchema,
  AdminStatsSchema,
  AdminUsersListSchema,
  CatalogUpdateSchema,
  HardDeleteSuccessSchema,
  SuccessSchema,
} from '@packrat/schemas/admin';
import { first } from '@packrat/utils';
import { and, count, desc, eq, ilike, or } from 'drizzle-orm';
import { Elysia, status } from 'elysia';
import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import { analyticsRoutes } from './analytics';
import { adminTrailsRoutes } from './trails';

const ADMIN_TOKEN_TTL_SECONDS = 3600; // 1 hour
const ADMIN_JWT_ISSUER = 'packrat-api';
const ADMIN_JWT_AUDIENCE = 'packrat-admin';

function checkAdminCredentials({
  username,
  password,
}: {
  username: string;
  password: string;
}): boolean {
  const env = getEnv();
  const userOk = timingSafeEqual({ a: username, b: env.ADMIN_USERNAME });
  const passOk = timingSafeEqual({ a: password, b: env.ADMIN_PASSWORD });
  return userOk && passOk;
}

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
    if (checkAdminCredentials({ username, password })) return { authorized: true };
  } catch {
    return { authorized: false };
  }
  return { authorized: false };
}

async function issueAdminJwt(username: string): Promise<string> {
  const env = getEnv();
  const secret = new TextEncoder().encode(env.BETTER_AUTH_SECRET);
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
    const secret = new TextEncoder().encode(env.BETTER_AUTH_SECRET);
    const { payload } = await jwtVerify(token, secret, {
      issuer: ADMIN_JWT_ISSUER,
      audience: ADMIN_JWT_AUDIENCE,
    });
    return payload.role === 'admin';
  } catch {
    return false;
  }
}

// Protected routes: Bearer JWT is always accepted.
// When CF Access is configured, CF JWT is also accepted directly (the CF edge
// injects Cf-Access-Jwt-Assertion on every request, so the user has already
// passed the CF Access gate).  Basic auth is accepted only in local dev.
async function adminAuthGuard(request: Request): Promise<boolean> {
  const env = getEnv();
  const { CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD } = env;
  const header = request.headers.get('authorization') ?? '';

  if (header.startsWith('Bearer ')) return verifyAdminJwt(header.slice(7));

  // When CF Access is configured, verify the CF JWT injected by the CF edge.
  if (CF_ACCESS_TEAM_DOMAIN && CF_ACCESS_AUD) {
    const cfIdentity = await verifyCFAccessRequest({
      request,
      opts: {
        teamDomain: CF_ACCESS_TEAM_DOMAIN,
        aud: CF_ACCESS_AUD,
      },
    });
    if (cfIdentity) return true;
  }

  // Local dev only: allow Basic auth directly on protected routes as a convenience.
  // Both CF vars absent AND non-production environment must hold — missing CF vars
  // alone is not enough so a misconfigured prod cannot fall back to Basic auth.
  if (
    env.ENVIRONMENT !== 'production' &&
    !CF_ACCESS_TEAM_DOMAIN &&
    !CF_ACCESS_AUD &&
    header.startsWith('Basic ')
  ) {
    return basicAuthGuard(request).authorized;
  }

  return false;
}

// ---------------------------------------------------------------------------

export const adminRoutes = new Elysia({ prefix: '/admin' })
  // Scoped CORS: credentials: true lets the admin SPA send its CF Access session
  // cookie cross-origin so CF Access can inject Cf-Access-Jwt-Assertion.
  // allowedHeaders must list Authorization explicitly (wildcards + credentials
  // is rejected by browsers per the CORS spec).
  .use(
    cors({
      // With credentials:true the browser requires a specific origin (not *).
      // Reflect origin back when it's in our allowlist.
      origin: (request) => {
        const origin = request.headers.get('origin');
        if (!origin) return false;
        if (origin === 'https://admin.packratai.com') return true;
        if (origin.endsWith('.workers.dev')) return true;
        if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
        return false;
      },
      credentials: true,
      allowedHeaders: ['Authorization', 'Content-Type'],
    }),
  )
  // Login (body-credential variant) — same credential semantics as /token,
  // but takes `{ username, password }` in the JSON body. Typed clients (MCP,
  // CLI, Eden Treaty) can hit this without overriding the Authorization
  // header. The Basic-auth /token route remains for the admin SPA.
  .post(
    '/login',
    async ({ body, request }) => {
      const env = getEnv();
      if (env.TOKEN_RATE_LIMITER) {
        const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
        const { success } = await env.TOKEN_RATE_LIMITER.limit({ key: ip });
        if (!success) return status(429, { error: 'Too many requests' });
      }
      const { CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD } = env;
      if (CF_ACCESS_TEAM_DOMAIN && CF_ACCESS_AUD) {
        const cfIdentity = await verifyCFAccessRequest({
          request,
          opts: {
            teamDomain: CF_ACCESS_TEAM_DOMAIN,
            aud: CF_ACCESS_AUD,
          },
        });
        if (!cfIdentity) return status(401, { error: 'CF Access authentication required' });
      }
      if (!checkAdminCredentials({ username: body.username, password: body.password })) {
        return status(401, { error: 'Invalid username or password' });
      }
      const token = await issueAdminJwt(body.username);
      return { token, expiresIn: ADMIN_TOKEN_TTL_SECONDS };
    },
    {
      body: z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      }),
      response: {
        200: z.object({ token: z.string(), expiresIn: z.number() }),
        401: z.object({ error: z.string() }),
        429: z.object({ error: z.string() }),
      },
      detail: {
        tags: ['Admin'],
        summary: 'Exchange JSON credentials for a short-lived admin JWT',
      },
    },
  )

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

      // CF JWT is an optional extra layer: required only when both CF vars are set.
      // The admin SPA sends credentials: 'include' so the CF Access session cookie
      // travels cross-origin; the CF edge then injects Cf-Access-Jwt-Assertion.
      // Basic credentials are always required and remain the primary gate.
      if (CF_ACCESS_TEAM_DOMAIN && CF_ACCESS_AUD) {
        const cfIdentity = await verifyCFAccessRequest({
          request,
          opts: {
            teamDomain: CF_ACCESS_TEAM_DOMAIN,
            aud: CF_ACCESS_AUD,
          },
        });
        if (!cfIdentity) return status(401, { error: 'CF Access authentication required' });
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
        summary:
          'Exchange Basic credentials for a short-lived admin JWT (CF JWT required when CF vars are set)',
      },
    },
  )
  .onBeforeHandle(async ({ request, path }) => {
    // Credential-exchange routes own their own auth gating (Basic for /token,
    // JSON body for /login). Skip the bearer guard for both.
    if (path === '/api/admin/token' || path === '/api/admin/login') return;
    if (request.method === 'OPTIONS') return;
    const ok = await adminAuthGuard(request);
    if (!ok) return status(401, { error: 'Unauthorized' });
  })

  // Stats
  .get(
    '/stats',
    async () => {
      const db = createDb();
      try {
        const [userCount] = await db.tag('admin.getStats').select({ count: count() }).from(users);
        const [packCount] = await db
          .tag('admin.getStats')
          .select({ count: count() })
          .from(packs)
          .where(eq(packs.deleted, false));
        const [itemCount] = await db
          .tag('admin.getStats')
          .select({ count: count() })
          .from(catalogItems);

        assertAllDefined({ values: [userCount, packCount, itemCount] });

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
      response: { 200: AdminStatsSchema, ...AdminErrorResponses },
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
        const searchFilter = search
          ? or(
              ilike(users.email, `%${search}%`),
              ilike(users.firstName, `%${search}%`),
              ilike(users.lastName, `%${search}%`),
            )
          : undefined;

        const [usersList, [totalRow]] = await Promise.all([
          db
            .tag('admin.getUsers')
            .select({
              id: users.id,
              email: users.email,
              firstName: users.firstName,
              lastName: users.lastName,
              role: users.role,
              emailVerified: users.emailVerified,
              avatarUrl: users.avatarUrl,
              createdAt: users.createdAt,
              updatedAt: users.updatedAt,
            })
            .from(users)
            .where(searchFilter)
            .orderBy(desc(users.createdAt))
            .limit(limit)
            .offset(offset),
          db.tag('admin.getUsersCount').select({ count: count() }).from(users).where(searchFilter),
        ]);

        return {
          data: usersList.map((u) => ({
            ...u,
            createdAt: u.createdAt?.toISOString() ?? null,
            updatedAt: u.updatedAt?.toISOString() ?? null,
          })),
          total: totalRow?.count ?? 0,
          limit,
          offset,
        };
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
      response: { 200: AdminUsersListSchema, ...AdminErrorResponses },
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
        const includeDeleted = query.includeDeleted ?? false;
        const searchFilter = search
          ? or(
              ilike(packs.name, `%${search}%`),
              ilike(packs.description, `%${search}%`),
              ilike(packs.category, `%${search}%`),
              ilike(users.email, `%${search}%`),
            )
          : undefined;
        const whereClause = includeDeleted
          ? searchFilter
          : and(eq(packs.deleted, false), searchFilter);

        const [packsList, [totalRow]] = await Promise.all([
          db
            .tag('admin.getPacks')
            .select({
              id: packs.id,
              name: packs.name,
              description: packs.description,
              category: packs.category,
              isPublic: packs.isPublic,
              isAIGenerated: packs.isAIGenerated,
              tags: packs.tags,
              image: packs.image,
              createdAt: packs.createdAt,
              updatedAt: packs.updatedAt,
              userEmail: users.email,
            })
            .from(packs)
            .leftJoin(users, eq(packs.userId, users.id))
            .where(whereClause)
            .orderBy(desc(packs.createdAt))
            .limit(limit)
            .offset(offset),
          db
            .tag('admin.getPacksCount')
            .select({ count: count() })
            .from(packs)
            .leftJoin(users, eq(packs.userId, users.id))
            .where(whereClause),
        ]);

        return {
          data: packsList.map((p) => ({
            ...p,
            createdAt: p.createdAt?.toISOString() ?? null,
            updatedAt: p.updatedAt?.toISOString() ?? null,
          })),
          total: totalRow?.count ?? 0,
          limit,
          offset,
        };
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
        // queryBoolean() instead of z.coerce.boolean() — the latter treats
        // any non-empty string as truthy, so ?includeDeleted=false would
        // wrongly include soft-deleted rows.
        includeDeleted: queryBoolean(),
      }),
      response: { 200: AdminPacksListSchema, ...AdminErrorResponses },
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
        const whereClause = search
          ? or(
              ilike(catalogItems.name, `%${search}%`),
              ilike(catalogItems.brand, `%${search}%`),
              ilike(catalogItems.description, `%${search}%`),
            )
          : undefined;

        const [itemsList, [totalRow]] = await Promise.all([
          db
            .tag('admin.getCatalogItems')
            .select({
              id: catalogItems.id,
              name: catalogItems.name,
              description: catalogItems.description,
              categories: catalogItems.categories,
              brand: catalogItems.brand,
              model: catalogItems.model,
              sku: catalogItems.sku,
              price: catalogItems.price,
              currency: catalogItems.currency,
              weight: catalogItems.weight,
              weightUnit: catalogItems.weightUnit,
              availability: catalogItems.availability,
              ratingValue: catalogItems.ratingValue,
              reviewCount: catalogItems.reviewCount,
              color: catalogItems.color,
              size: catalogItems.size,
              material: catalogItems.material,
              seller: catalogItems.seller,
              productUrl: catalogItems.productUrl,
              images: catalogItems.images,
              variants: catalogItems.variants,
              techs: catalogItems.techs,
              links: catalogItems.links,
              createdAt: catalogItems.createdAt,
            })
            .from(catalogItems)
            .where(whereClause)
            .orderBy(desc(catalogItems.id))
            .limit(limit)
            .offset(offset),
          db
            .tag('admin.getCatalogItemsCount')
            .select({ count: count() })
            .from(catalogItems)
            .where(whereClause),
        ]);

        return {
          data: itemsList.map((it) => ({
            ...it,
            createdAt: it.createdAt?.toISOString() ?? null,
          })),
          total: totalRow?.count ?? 0,
          limit,
          offset,
        };
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
      response: { 200: AdminCatalogListSchema, ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'List catalog items' },
    },
  )

  // Soft-delete a user
  .delete(
    '/users/:id',
    async ({ params }) => {
      const id = params.id;
      if (!id) return status(400, { error: 'Invalid user id' });
      // Soft delete not supported for users in Better Auth - use hard delete or ban instead
      return status(400, {
        error: 'Soft delete not supported for users. Use hard delete endpoint or ban user.',
      });
    },
    {
      params: z.object({ id: z.string() }),
      response: { 200: SuccessSchema, ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'Soft-delete a user (recoverable)' },
    },
  )

  // Hard-delete a user for compliance (GDPR / right to erasure)
  .delete(
    '/users/:id/hard',
    async ({ params, body }) => {
      const id = params.id;
      if (!id) return status(400, { error: 'Invalid user id' });
      const db = createDb();
      try {
        // Cascading FKs handle deletion of all related user data.
        // Caller must supply a compliance reason for the audit log.
        const deleted = await db
          .tag('admin.deleteUser')
          .delete(users)
          .where(eq(users.id, id))
          .returning();
        if (!deleted.length) return status(404, { error: 'User not found' });
        console.info(`[COMPLIANCE] Hard-deleted user ${id}. Reason: ${body.reason}`);
        return { success: true as const, purged: true as const };
      } catch (error) {
        if ((error as { code?: string })?.code === '23503') {
          return status(409, { error: 'Cannot delete: user has dependent data without cascade' });
        }
        console.error('Error hard-deleting user:', error);
        return status(500, { error: 'Failed to hard-delete user' });
      }
    },
    {
      params: z.object({ id: z.string() }),
      body: z.object({
        reason: z.string().min(1, 'Compliance reason is required'),
      }),
      response: { 200: HardDeleteSuccessSchema, ...AdminErrorResponses },
      detail: {
        tags: ['Admin'],
        summary: 'Hard-delete a user and all their data (irreversible, for GDPR compliance)',
      },
    },
  )

  // Restore a soft-deleted user
  .post(
    '/users/:id/restore',
    async ({ params }) => {
      const id = params.id;
      if (!id) return status(400, { error: 'Invalid user id' });
      // Soft delete not supported for users in Better Auth
      return status(400, { error: 'Soft delete not supported for users in Better Auth' });
    },
    {
      params: z.object({ id: z.string() }),
      response: { 200: SuccessSchema, ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'Restore a soft-deleted user' },
    },
  )

  // Soft-delete a pack
  .delete(
    '/packs/:id',
    async ({ params }) => {
      const db = createDb();
      try {
        const updated = await db
          .tag('admin.deletePack')
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
      response: { 200: SuccessSchema, ...AdminErrorResponses },
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
        const deleted = await db
          .tag('admin.deleteCatalogItem')
          .delete(catalogItems)
          .where(eq(catalogItems.id, id))
          .returning(); // lint:allow-unprojected-fat-table reason: admin delete only checks .length; could narrow to .returning({id}) but defer to pivot-migration cleanup pass
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
      response: { 200: SuccessSchema, ...AdminErrorResponses },
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
          .tag('admin.updateCatalogItem')
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
          .returning(); // lint:allow-unprojected-fat-table reason: admin update reads only first.id + first.name; Drizzle 0.45 update returning() overload rejects projection here
        const firstUpdated = first(updated);
        if (!firstUpdated) return status(404, { error: 'Catalog item not found' });
        return { id: firstUpdated.id, name: firstUpdated.name };
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
      response: { 200: CatalogUpdateSchema, ...AdminErrorResponses },
      detail: { tags: ['Admin'], summary: 'Update a catalog item' },
    },
  )
  .use(analyticsRoutes)
  .use(adminTrailsRoutes);
