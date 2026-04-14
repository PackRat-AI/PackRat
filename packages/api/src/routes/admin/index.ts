import { createDb } from '@packrat/api/db';
import { catalogItems, packs, users } from '@packrat/api/db/schema';
import { timingSafeEqual } from '@packrat/api/utils/auth';
import { getEnv } from '@packrat/api/utils/env-validation';
import { assertAllDefined } from '@packrat/guards';
import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { Elysia, status } from 'elysia';
import { z } from 'zod';

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

function unauthorizedHtml(): Response {
  return new Response('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="PackRat Admin Panel"' },
  });
}

function htmlResponse(body: string): Response {
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/html' } });
}

const adminLayout = (title: string, content: string) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - PackRat Admin</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/htmx.org@1.9.10"></script>
    <script>
        tailwind.config = {
          theme: {
            extend: {
              colors: {
                primary: '#667eea',
                secondary: '#764ba2'
              }
            }
          }
        };
    </script>
</head>
<body class="bg-gradient-to-br from-primary to-secondary min-h-screen">
    <div class="container mx-auto p-6 max-w-7xl">
        <div class="bg-white/95 backdrop-blur-sm rounded-xl p-6 mb-6 shadow-xl border border-white/20">
            <h1 class="text-3xl font-bold text-gray-800 mb-4">🎒 PackRat Admin Panel</h1>
            <nav class="flex gap-4 flex-wrap">
                <a href="/api/admin" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">Dashboard</a>
                <a href="/api/admin/users" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">Users</a>
                <a href="/api/admin/packs" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">Packs</a>
                <a href="/api/admin/catalog" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">Catalog</a>
            </nav>
        </div>
        <div id="main-content" class="bg-white/95 backdrop-blur-sm rounded-xl p-8 shadow-xl border border-white/20">
            ${content}
        </div>
    </div>
</body>
</html>`;

// ---------------------------------------------------------------------------

export const adminRoutes = new Elysia({ prefix: '/admin' })
  .onBeforeHandle(({ request }) => {
    const auth = basicAuthGuard(request);
    if (!auth.authorized) return unauthorizedHtml();
  })

  // Dashboard
  .get('/', () => {
    const content = `
    <h2 class="text-2xl font-bold mb-6">Dashboard Overview</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div class="bg-gradient-to-r from-primary to-secondary text-white p-6 rounded-lg shadow-lg">
            <h3 class="text-2xl font-bold" id="user-count">Loading...</h3>
            <p class="opacity-90 font-medium">Total Users</p>
        </div>
        <div class="bg-gradient-to-r from-primary to-secondary text-white p-6 rounded-lg shadow-lg">
            <h3 class="text-2xl font-bold" id="pack-count">Loading...</h3>
            <p class="opacity-90 font-medium">Total Packs</p>
        </div>
        <div class="bg-gradient-to-r from-primary to-secondary text-white p-6 rounded-lg shadow-lg">
            <h3 class="text-2xl font-bold" id="item-count">Loading...</h3>
            <p class="opacity-90 font-medium">Catalog Items</p>
        </div>
        <div class="bg-gradient-to-r from-primary to-secondary text-white p-6 rounded-lg shadow-lg">
            <h3 class="text-2xl font-bold">✅</h3>
            <p class="opacity-90 font-medium">System Health</p>
        </div>
    </div>
    <script>
        htmx.onLoad(async function() {
            try {
                const response = await fetch('/api/admin/stats');
                const stats = await response.json();
                document.getElementById('user-count').textContent = stats.users || '0';
                document.getElementById('pack-count').textContent = stats.packs || '0';
                document.getElementById('item-count').textContent = stats.items || '0';
            } catch (error) {
                console.error('Failed to load dashboard stats:', error);
            }
        });
    </script>
    `;
    return htmlResponse(adminLayout('Dashboard', content));
  })

  // Stats (JSON)
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
      detail: {
        tags: ['Admin'],
        summary: 'Get admin dashboard statistics',
      },
    },
  )

  // Users list JSON
  .get(
    '/users-list',
    async ({ query }) => {
      const db = createDb();
      try {
        const limit = Number(query.limit ?? 100);
        const offset = Number(query.offset ?? 0);
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
      }),
      detail: { tags: ['Admin'], summary: 'List all users' },
    },
  )

  // Packs list JSON
  .get(
    '/packs-list',
    async ({ query }) => {
      const db = createDb();
      try {
        const limit = Number(query.limit ?? 100);
        const offset = Number(query.offset ?? 0);
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
          .where(eq(packs.deleted, false))
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
      }),
      detail: { tags: ['Admin'], summary: 'List all packs' },
    },
  )

  // Catalog list JSON
  .get(
    '/catalog-list',
    async ({ query }) => {
      const db = createDb();
      try {
        const limit = Number(query.limit ?? 25);
        const offset = Number(query.offset ?? 0);
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
      }),
      detail: { tags: ['Admin'], summary: 'List catalog items' },
    },
  )

  // HTMX endpoints - users table / search
  .get('/users', () => {
    const content = `
    <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold">User Management</h2>
    </div>
    <div class="mb-4">
        <div class="flex gap-2">
            <input type="text" id="user-search" name="q" placeholder="Search users..."
                   class="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                   hx-get="/api/admin/users-search" hx-target="#users-table"
                   hx-trigger="keyup changed delay:500ms" hx-swap="innerHTML">
            <button hx-get="/api/admin/users-table" hx-target="#users-table" hx-swap="innerHTML"
                    class="px-4 py-2 bg-blue-500 text-white rounded-lg">Load All</button>
        </div>
    </div>
    <div class="overflow-x-auto">
        <table class="w-full bg-white rounded-lg shadow-sm">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verified</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200" id="users-table"></tbody>
        </table>
    </div>
    `;
    return htmlResponse(adminLayout('Users', content));
  })
  .get('/users-table', async () => {
    const db = createDb();
    try {
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
        .orderBy(desc(users.createdAt))
        .limit(100);

      const rows = usersList
        .map(
          (u) => `
          <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${u.id}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${u.email}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${`${u.firstName || ''} ${u.lastName || ''}`}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
              <span class="px-2 py-1 text-xs font-semibold rounded-full ${
                u.role === 'ADMIN' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
              }">${u.role || 'USER'}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${u.emailVerified ? '✅' : '❌'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium"></td>
          </tr>`,
        )
        .join('');
      return htmlResponse(
        rows ||
          '<tr><td colspan="7" class="px-6 py-4 text-center text-gray-500">No users found</td></tr>',
      );
    } catch (error) {
      console.error('Error fetching users:', error);
      return htmlResponse(
        '<tr><td colspan="7" class="px-6 py-4 text-center text-red-500">Error loading users</td></tr>',
      );
    }
  })
  .get(
    '/users-search',
    async ({ query }) => {
      const db = createDb();
      const search = query.q ?? '';
      try {
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
          .limit(100);

        const rows = usersList
          .map(
            (u) => `
          <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 text-sm font-medium text-gray-900">${u.id}</td>
            <td class="px-6 py-4 text-sm text-gray-500">${u.email}</td>
            <td class="px-6 py-4 text-sm text-gray-500">${`${u.firstName || ''} ${u.lastName || ''}`}</td>
            <td class="px-6 py-4 text-sm font-medium"><span class="px-2 py-1 text-xs font-semibold rounded-full ${u.role === 'ADMIN' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}">${u.role || 'USER'}</span></td>
            <td class="px-6 py-4 text-sm text-gray-500">${u.emailVerified ? '✅' : '❌'}</td>
            <td class="px-6 py-4 text-sm text-gray-500">${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}</td>
            <td class="px-6 py-4 text-sm font-medium"></td>
          </tr>`,
          )
          .join('');
        return htmlResponse(
          rows ||
            '<tr><td colspan="7" class="px-6 py-4 text-center text-gray-500">No users found</td></tr>',
        );
      } catch (error) {
        console.error('Error searching users:', error);
        return htmlResponse(
          '<tr><td colspan="7" class="px-6 py-4 text-center text-red-500">Error searching users</td></tr>',
        );
      }
    },
    {
      query: z.object({ q: z.string().optional() }),
    },
  )

  // Packs UI
  .get('/packs', () => {
    const content = `
    <h2 class="text-2xl font-bold mb-6">Pack Management</h2>
    <div class="mb-4">
        <div class="flex gap-2">
            <input type="text" name="q" placeholder="Search packs..."
                   class="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                   hx-get="/api/admin/packs-search" hx-target="#packs-table"
                   hx-trigger="keyup changed delay:500ms">
            <button hx-get="/api/admin/packs-table" hx-target="#packs-table" hx-swap="innerHTML"
                    class="px-4 py-2 bg-blue-500 text-white rounded-lg">Load All</button>
        </div>
    </div>
    <div class="overflow-x-auto">
        <table class="w-full bg-white rounded-lg shadow-sm">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Public</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200" id="packs-table"></tbody>
        </table>
    </div>
    `;
    return htmlResponse(adminLayout('Packs', content));
  })
  .get('/packs-table', async () => {
    const db = createDb();
    try {
      const packsList = await db
        .select({
          id: packs.id,
          name: packs.name,
          category: packs.category,
          isPublic: packs.isPublic,
          createdAt: packs.createdAt,
          userEmail: users.email,
        })
        .from(packs)
        .leftJoin(users, eq(packs.userId, users.id))
        .where(eq(packs.deleted, false))
        .orderBy(desc(packs.createdAt))
        .limit(100);

      const rows = packsList
        .map(
          (p) => `
        <tr class="hover:bg-gray-50">
          <td class="px-6 py-4 text-sm font-medium text-gray-900">${p.name}</td>
          <td class="px-6 py-4 text-sm text-gray-500">${p.userEmail || 'Unknown'}</td>
          <td class="px-6 py-4 text-sm text-gray-500">${p.category || 'Uncategorized'}</td>
          <td class="px-6 py-4 text-sm text-gray-500">${p.isPublic ? '✅' : '❌'}</td>
          <td class="px-6 py-4 text-sm text-gray-500">${p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'N/A'}</td>
          <td class="px-6 py-4 text-sm font-medium"></td>
        </tr>`,
        )
        .join('');
      return htmlResponse(
        rows ||
          '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">No packs found</td></tr>',
      );
    } catch (error) {
      console.error('Error fetching packs:', error);
      return htmlResponse(
        '<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">Error loading packs</td></tr>',
      );
    }
  })
  .get(
    '/packs-search',
    async ({ query }) => {
      const db = createDb();
      const search = query.q ?? '';
      try {
        const packsList = await db
          .select({
            id: packs.id,
            name: packs.name,
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
          .limit(100);

        const rows = packsList
          .map(
            (p) => `
          <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 text-sm font-medium text-gray-900">${p.name}</td>
            <td class="px-6 py-4 text-sm text-gray-500">${p.userEmail || 'Unknown'}</td>
            <td class="px-6 py-4 text-sm text-gray-500">${p.category || 'Uncategorized'}</td>
            <td class="px-6 py-4 text-sm text-gray-500">${p.isPublic ? '✅' : '❌'}</td>
            <td class="px-6 py-4 text-sm text-gray-500">${p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'N/A'}</td>
            <td class="px-6 py-4 text-sm font-medium"></td>
          </tr>`,
          )
          .join('');
        return htmlResponse(
          rows ||
            '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">No packs found</td></tr>',
        );
      } catch (error) {
        console.error('Error searching packs:', error);
        return htmlResponse(
          '<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">Error searching packs</td></tr>',
        );
      }
    },
    {
      query: z.object({ q: z.string().optional() }),
    },
  )

  // Catalog UI
  .get('/catalog', () => {
    const content = `
    <h2 class="text-2xl font-bold mb-6">Catalog Management</h2>
    <div class="mb-4">
        <div class="flex gap-2">
            <input type="text" name="q" placeholder="Search catalog..."
                   class="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                   hx-get="/api/admin/catalog-search" hx-target="#catalog-table"
                   hx-trigger="keyup changed delay:500ms">
            <button hx-get="/api/admin/catalog-table" hx-target="#catalog-table" hx-swap="innerHTML"
                    class="px-4 py-2 bg-blue-500 text-white rounded-lg">Load All</button>
        </div>
    </div>
    <div class="overflow-x-auto">
        <table class="w-full bg-white rounded-lg shadow-sm">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Brand</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Weight</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200" id="catalog-table"></tbody>
        </table>
    </div>
    `;
    return htmlResponse(adminLayout('Catalog', content));
  })
  .get('/catalog-table', async () => {
    const db = createDb();
    try {
      const itemsList = await db
        .select({
          id: catalogItems.id,
          name: catalogItems.name,
          categories: catalogItems.categories,
          brand: catalogItems.brand,
          price: catalogItems.price,
          weight: catalogItems.weight,
          weightUnit: catalogItems.weightUnit,
        })
        .from(catalogItems)
        .orderBy(desc(catalogItems.id))
        .limit(25);

      const rows = itemsList
        .map(
          (i) => `
        <tr class="hover:bg-gray-50">
          <td class="px-6 py-4 text-sm font-medium text-gray-900">${i.name}</td>
          <td class="px-6 py-4 text-sm text-gray-500">${i.brand || 'Unknown'}</td>
          <td class="px-6 py-4 text-sm text-gray-500">${i.categories?.join(', ') || 'Uncategorized'}</td>
          <td class="px-6 py-4 text-sm text-gray-500">${i.weight ? `${i.weight} ${i.weightUnit || 'g'}` : 'N/A'}</td>
          <td class="px-6 py-4 text-sm text-gray-500">${i.price ? `$${i.price}` : 'N/A'}</td>
          <td class="px-6 py-4 text-sm font-medium"></td>
        </tr>`,
        )
        .join('');
      return htmlResponse(
        rows ||
          '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">No catalog items found</td></tr>',
      );
    } catch (error) {
      console.error('Error fetching catalog items:', error);
      return htmlResponse(
        '<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">Error loading catalog</td></tr>',
      );
    }
  })
  .get(
    '/catalog-search',
    async ({ query }) => {
      const db = createDb();
      const search = query.q ?? '';
      try {
        const itemsList = await db
          .select({
            id: catalogItems.id,
            name: catalogItems.name,
            categories: catalogItems.categories,
            brand: catalogItems.brand,
            price: catalogItems.price,
            weight: catalogItems.weight,
            weightUnit: catalogItems.weightUnit,
          })
          .from(catalogItems)
          .where(
            search
              ? or(
                  ilike(catalogItems.name, `%${search}%`),
                  ilike(catalogItems.brand, `%${search}%`),
                  sql`EXISTS (SELECT 1 FROM jsonb_array_elements_text(${catalogItems.categories}::jsonb) AS cat WHERE cat ILIKE '%' || ${search} || '%')`,
                  ilike(catalogItems.description, `%${search}%`),
                )
              : undefined,
          )
          .orderBy(desc(catalogItems.id))
          .limit(25);

        const rows = itemsList
          .map(
            (i) => `
          <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 text-sm font-medium text-gray-900">${i.name}</td>
            <td class="px-6 py-4 text-sm text-gray-500">${i.brand || 'Unknown'}</td>
            <td class="px-6 py-4 text-sm text-gray-500">${i.categories?.join(', ') || 'Uncategorized'}</td>
            <td class="px-6 py-4 text-sm text-gray-500">${i.weight ? `${i.weight} ${i.weightUnit || 'g'}` : 'N/A'}</td>
            <td class="px-6 py-4 text-sm text-gray-500">${i.price ? `$${i.price}` : 'N/A'}</td>
            <td class="px-6 py-4 text-sm font-medium"></td>
          </tr>`,
          )
          .join('');
        return htmlResponse(
          rows ||
            '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">No catalog items found</td></tr>',
        );
      } catch (error) {
        console.error('Error searching catalog items:', error);
        return htmlResponse(
          '<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">Error searching catalog</td></tr>',
        );
      }
    },
    {
      query: z.object({ q: z.string().optional() }),
    },
  );
