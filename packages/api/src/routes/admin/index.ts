import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { catalogItems, packs, users } from '@packrat/api/db/schema';
import { ErrorResponseSchema } from '@packrat/api/schemas/catalog';
import { UserSearchQuerySchema } from '@packrat/api/schemas/users';
import type { Env } from '@packrat/api/utils/env-validation';
import { getEnv } from '@packrat/api/utils/env-validation';
import { assertAllDefined } from '@packrat/api/utils/typeAssertions';
import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { basicAuth } from 'hono/basic-auth';
import { html, raw } from 'hono/html';
import { z } from 'zod';

const adminRoutes = new OpenAPIHono<{ Bindings: Env }>();

adminRoutes.use(
  '*',
  (_c, next) => {
    console.log('adminRoutes');
    return next();
  },
  basicAuth({
    verifyUser: (username, password, c) => {
      return username === getEnv(c).ADMIN_USERNAME && password === getEnv(c).ADMIN_PASSWORD;
    },
    realm: 'PackRat Admin Panel',
  }),
);

const adminLayout = (title: string, content: unknown) => html`
<!DOCTYPE html>
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
            ${raw(content)}
        </div>
    </div>
</body>
</html>
`;

adminRoutes.get('/', async (c) => {
  const content = html`
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

    <h3 class="text-xl font-semibold mb-4">Quick Actions</h3>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button hx-get="/api/admin/users" hx-target="#main-content" hx-swap="innerHTML" 
                class="p-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
            Manage Users
        </button>
        <button hx-get="/api/admin/packs" hx-target="#main-content" hx-swap="innerHTML"
                class="p-4 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
            Manage Packs
        </button>
        <button hx-get="/api/admin/catalog" hx-target="#main-content" hx-swap="innerHTML"
                class="p-4 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors">
            Manage Catalog
        </button>
    </div>

    <script>
        // Load dashboard stats on page load
        htmx.onLoad(function() {
            loadDashboardStats();
        });
        
        async function loadDashboardStats() {
            try {
                const response = await fetch('/api/admin/stats', {
                    headers: {
                        'Authorization': 'Basic ' + btoa('admin:password')
                    }
                });
                const stats = await response.json();
                if (stats) {
                    document.getElementById('user-count').textContent = stats.users || '0';
                    document.getElementById('pack-count').textContent = stats.packs || '0';
                    document.getElementById('item-count').textContent = stats.items || '0';
                }
            } catch (error) {
                console.error('Failed to load dashboard stats:', error);
            }
        }
    </script>
  `;

  return c.html(adminLayout('Dashboard', content));
});

adminRoutes.get('/users', async (c) => {
  const content = html`
    <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold">User Management</h2>
        <button class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
            Add User
        </button>
    </div>

    <div class="mb-4">
        <div class="flex gap-2">
            <input type="text" 
                   id="user-search" 
                   name="q"
                   placeholder="Search users by email, name..." 
                   class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                   hx-get="/api/admin/users-search"
                   hx-target="#users-table"
                   hx-trigger="keyup changed delay:500ms"
                   hx-swap="innerHTML">
            <button hx-get="/api/admin/users-table" 
                    hx-target="#users-table" 
                    hx-swap="innerHTML"
                    class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                Load All
            </button>
        </div>
    </div>

    <div class="overflow-x-auto">
        <table class="w-full bg-white rounded-lg shadow-sm">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Verified</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200" id="users-table">
                <tr>
                    <td colspan="7" class="px-6 py-4 text-center text-gray-500">
                        <div class="flex items-center justify-center">
                            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                            <span class="ml-2">Loading users...</span>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>

    <script>
        // Auto-load users when page loads
        htmx.onLoad(function() {
            htmx.trigger('#users-table', 'loadUsers');
        });
        
        // Add event listener for search input
        document.addEventListener('DOMContentLoaded', function() {
            const searchInput = document.getElementById('user-search');
            if (searchInput) {
                searchInput.addEventListener('input', function() {
                    const query = this.value;
                    if (query.length >= 2 || query.length === 0) {
                        htmx.ajax('GET', '/api/admin/users-search?q=' + encodeURIComponent(query), {
                            target: '#users-table',
                            swap: 'innerHTML'
                        });
                    }
                });
            }
        });
    </script>
  `;

  return c.html(adminLayout('Users', content));
});

adminRoutes.get('/packs', async (c) => {
  const content = html`
    <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold">Pack Management</h2>
        <button class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
            Add Pack
        </button>
    </div>

    <div class="mb-4">
        <div class="flex gap-2">
            <input type="text" 
                   id="pack-search" 
                   name="q"
                   placeholder="Search packs by name, category, owner..." 
                   class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                   hx-get="/api/admin/packs-search"
                   hx-target="#packs-table"
                   hx-trigger="keyup changed delay:500ms"
                   hx-swap="innerHTML">
            <button hx-get="/api/admin/packs-table" 
                    hx-target="#packs-table" 
                    hx-swap="innerHTML"
                    class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                Load All
            </button>
        </div>
    </div>

    <div class="overflow-x-auto">
        <table class="w-full bg-white rounded-lg shadow-sm">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Public</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200" id="packs-table">
                <tr>
                    <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                        <div class="flex items-center justify-center">
                            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                            <span class="ml-2">Loading packs...</span>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>

    <script>
        // Auto-load packs when page loads
        htmx.onLoad(function() {
            htmx.trigger('#packs-table', 'loadPacks');
        });
        
        // Add event listener for search input
        document.addEventListener('DOMContentLoaded', function() {
            const searchInput = document.getElementById('pack-search');
            if (searchInput) {
                searchInput.addEventListener('input', function() {
                    const query = this.value;
                    if (query.length >= 2 || query.length === 0) {
                        htmx.ajax('GET', '/api/admin/packs-search?q=' + encodeURIComponent(query), {
                            target: '#packs-table',
                            swap: 'innerHTML'
                        });
                    }
                });
            }
        });
    </script>
  `;

  return c.html(adminLayout('Packs', content));
});

adminRoutes.get('/catalog', async (c) => {
  const content = html`
    <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold">Catalog Management</h2>
        <button class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
            Add Item
        </button>
    </div>

    <div class="mb-4">
        <div class="flex gap-2">
            <input type="text" 
                   id="catalog-search" 
                   name="q"
                   placeholder="Search items by name, brand, category..." 
                   class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                   hx-get="/api/admin/catalog-search"
                   hx-target="#catalog-table"
                   hx-trigger="keyup changed delay:500ms"
                   hx-swap="innerHTML">
            <button hx-get="/api/admin/catalog-table" 
                    hx-target="#catalog-table" 
                    hx-swap="innerHTML"
                    class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                Load All
            </button>
        </div>
    </div>

    <div class="overflow-x-auto">
        <table class="w-full bg-white rounded-lg shadow-sm">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weight</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200" id="catalog-table">
                <tr>
                    <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                        <div class="flex items-center justify-center">
                            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                            <span class="ml-2">Loading catalog...</span>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>

    <script>
        // Auto-load catalog when page loads
        htmx.onLoad(function() {
            htmx.trigger('#catalog-table', 'loadCatalog');
        });
        
        // Add event listener for search input
        document.addEventListener('DOMContentLoaded', function() {
            const searchInput = document.getElementById('catalog-search');
            if (searchInput) {
                searchInput.addEventListener('input', function() {
                    const query = this.value;
                    if (query.length >= 2 || query.length === 0) {
                        htmx.ajax('GET', '/api/admin/catalog-search?q=' + encodeURIComponent(query), {
                            target: '#catalog-table',
                            swap: 'innerHTML'
                        });
                    }
                });
            }
        });
    </script>
  `;

  return c.html(adminLayout('Catalog', content));
});

// HTMX endpoints for table data
adminRoutes.get('/users-table', async (c) => {
  const db = createDb(c);

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
        (user) => `
      <tr class="hover:bg-gray-50">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${user.id}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.email}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${`${user.firstName || ''} ${user.lastName || ''}`}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <span class="px-2 py-1 text-xs font-semibold rounded-full ${
            user.role === 'ADMIN' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
          }">${user.role || 'USER'}</span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.emailVerified ? '✅' : '❌'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <button class="text-blue-600 hover:text-blue-900 mr-2" onclick="editUser(${user.id})">Edit</button>
          <button class="text-red-600 hover:text-red-900" onclick="deleteUser(${user.id})">Delete</button>
        </td>
      </tr>
    `,
      )
      .join('');

    return c.html(
      rows ||
        '<tr><td colspan="7" class="px-6 py-4 text-center text-gray-500">No users found</td></tr>',
    );
  } catch (error) {
    console.error('Error fetching users:', error);
    return c.html(
      '<tr><td colspan="7" class="px-6 py-4 text-center text-red-500">Error loading users</td></tr>',
    );
  }
});

adminRoutes.get('/packs-table', async (c) => {
  const db = createDb(c);

  try {
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
      .limit(100);

    const rows = packsList
      .map(
        (pack) => `
      <tr class="hover:bg-gray-50">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${pack.name}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${pack.userEmail || 'Unknown'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${pack.category || 'Uncategorized'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${pack.isPublic ? '✅' : '❌'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${pack.createdAt ? new Date(pack.createdAt).toLocaleDateString() : 'N/A'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <button class="text-blue-600 hover:text-blue-900 mr-2" onclick="viewPack('${pack.id}')">View</button>
          <button class="text-red-600 hover:text-red-900" onclick="deletePack('${pack.id}')">Delete</button>
        </td>
      </tr>
    `,
      )
      .join('');

    return c.html(
      rows ||
        '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">No packs found</td></tr>',
    );
  } catch (error) {
    console.error('Error fetching packs:', error);
    return c.html(
      '<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">Error loading packs</td></tr>',
    );
  }
});

adminRoutes.get('/catalog-table', async (c) => {
  const db = createDb(c);

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
        createdAt: catalogItems.createdAt,
      })
      .from(catalogItems)
      .orderBy(desc(catalogItems.id))
      .limit(25);

    const rows = itemsList
      .map(
        (item) => `
      <tr class="hover:bg-gray-50">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${item.name}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.brand || 'Unknown'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.categories?.join(', ') || 'Uncategorized'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${
          item.weight ? `${item.weight} ${item.weightUnit || 'g'}` : 'N/A'
        }</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${
          item.price ? `$${item.price}` : 'N/A'
        }</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <button class="text-blue-600 hover:text-blue-900 mr-2" onclick="editItem(${item.id})">Edit</button>
          <button class="text-red-600 hover:text-red-900" onclick="deleteItem(${item.id})">Delete</button>
        </td>
      </tr>
    `,
      )
      .join('');

    return c.html(
      rows ||
        '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">No catalog items found</td></tr>',
    );
  } catch (error) {
    console.error('Error fetching catalog items:', error);
    return c.html(
      '<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">Error loading catalog</td></tr>',
    );
  }
});

// Search endpoints
adminRoutes.get('/users-search', async (c) => {
  const db = createDb(c);
  const search = c.req.query('q') || '';

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
        (user) => `
      <tr class="hover:bg-gray-50">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${user.id}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.email}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${`${user.firstName || ''} ${user.lastName || ''}`}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <span class="px-2 py-1 text-xs font-semibold rounded-full ${
            user.role === 'ADMIN' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
          }">${user.role || 'USER'}</span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.emailVerified ? '✅' : '❌'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <button class="text-blue-600 hover:text-blue-900 mr-2" onclick="editUser(${user.id})">Edit</button>
          <button class="text-red-600 hover:text-red-900" onclick="deleteUser(${user.id})">Delete</button>
        </td>
      </tr>
    `,
      )
      .join('');

    return c.html(
      rows ||
        '<tr><td colspan="7" class="px-6 py-4 text-center text-gray-500">No users found</td></tr>',
    );
  } catch (error) {
    console.error('Error searching users:', error);
    return c.html(
      '<tr><td colspan="7" class="px-6 py-4 text-center text-red-500">Error searching users</td></tr>',
    );
  }
});

adminRoutes.get('/packs-search', async (c) => {
  const db = createDb(c);
  const search = c.req.query('q') || '';

  try {
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
      .limit(100);

    const rows = packsList
      .map(
        (pack) => `
      <tr class="hover:bg-gray-50">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${pack.name}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${pack.userEmail || 'Unknown'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${pack.category || 'Uncategorized'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${pack.isPublic ? '✅' : '❌'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${pack.createdAt ? new Date(pack.createdAt).toLocaleDateString() : 'N/A'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <button class="text-blue-600 hover:text-blue-900 mr-2" onclick="viewPack('${pack.id}')">View</button>
          <button class="text-red-600 hover:text-red-900" onclick="deletePack('${pack.id}')">Delete</button>
        </td>
      </tr>
    `,
      )
      .join('');

    return c.html(
      rows ||
        '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">No packs found</td></tr>',
    );
  } catch (error) {
    console.error('Error searching packs:', error);
    return c.html(
      '<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">Error searching packs</td></tr>',
    );
  }
});

adminRoutes.get('/catalog-search', async (c) => {
  const db = createDb(c);
  const search = c.req.query('q') || '';

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
        createdAt: catalogItems.createdAt,
      })
      .from(catalogItems)
      .where(
        search
          ? or(
              ilike(catalogItems.name, `%${search}%`),
              ilike(catalogItems.brand, `%${search}%`),
              // Partial match in any category (uses jsonb_array_elements_text and ILIKE)
              sql`
                  EXISTS (
                    SELECT 1 FROM jsonb_array_elements_text(${catalogItems.categories}::jsonb) AS cat
                    WHERE cat ILIKE '%' || ${search} || '%'
                  )
                `,
              ilike(catalogItems.description, `%${search}%`),
            )
          : undefined,
      )
      .orderBy(desc(catalogItems.id))
      .limit(25);

    const rows = itemsList
      .map(
        (item) => `
      <tr class="hover:bg-gray-50">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${item.name}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.brand || 'Unknown'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.categories?.join(', ') || 'Uncategorized'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${
          item.weight ? `${item.weight} ${item.weightUnit || 'g'}` : 'N/A'
        }</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${
          item.price ? `$${item.price}` : 'N/A'
        }</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <button class="text-blue-600 hover:text-blue-900 mr-2" onclick="editItem(${item.id})">Edit</button>
          <button class="text-red-600 hover:text-red-900" onclick="deleteItem(${item.id})">Delete</button>
        </td>
      </tr>
    `,
      )
      .join('');

    return c.html(
      rows ||
        '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">No catalog items found</td></tr>',
    );
  } catch (error) {
    console.error('Error searching catalog items:', error);
    return c.html(
      '<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">Error searching catalog</td></tr>',
    );
  }
});

// Admin API endpoints for getting data
const getStatsRoute = createRoute({
  method: 'get',
  path: '/stats',
  tags: ['Admin'],
  summary: 'Get admin dashboard statistics',
  description: 'Get count statistics for users, packs, and catalog items (Admin only)',
  responses: {
    200: {
      description: 'Admin statistics retrieved successfully',
      content: {
        'application/json': {
          schema: z.object({
            users: z.number().int().min(0),
            packs: z.number().int().min(0),
            items: z.number().int().min(0),
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized - Admin access required',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

adminRoutes.openapi(getStatsRoute, async (c) => {
  const db = createDb(c);

  try {
    const [userCount] = await db.select({ count: count() }).from(users);
    const [packCount] = await db
      .select({ count: count() })
      .from(packs)
      .where(eq(packs.deleted, false));
    const [itemCount] = await db.select({ count: count() }).from(catalogItems);

    assertAllDefined(userCount, packCount, itemCount);

    return c.json({
      users: userCount.count,
      packs: packCount.count,
      items: itemCount.count,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return c.json({ error: 'Failed to fetch stats' }, 500);
  }
});

// Keep the existing API endpoints for backward compatibility
const getUsersListRoute = createRoute({
  method: 'get',
  path: '/users-list',
  tags: ['Admin'],
  summary: 'List all users',
  description: 'Get a list of all users in the system (Admin only)',
  request: {
    query: UserSearchQuerySchema.pick({ limit: true, offset: true }),
  },
  responses: {
    200: {
      description: 'Users list retrieved successfully',
      content: {
        'application/json': {
          schema: z.array(
            z.object({
              id: z.number(),
              email: z.string(),
              firstName: z.string().nullable(),
              lastName: z.string().nullable(),
              role: z.string().nullable(),
              emailVerified: z.boolean().nullable(),
              createdAt: z.string().nullable(),
            }),
          ),
        },
      },
    },
    401: {
      description: 'Unauthorized - Admin access required',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

adminRoutes.openapi(getUsersListRoute, async (c) => {
  const db = createDb(c);

  try {
    const { limit = 100, offset = 0 } = c.req.query();
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
      .limit(Number(limit))
      .offset(Number(offset));

    const formattedUsers = usersList.map((user) => ({
      ...user,
      createdAt: user.createdAt?.toISOString() || null,
    }));

    return c.json(formattedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

const getPacksListRoute = createRoute({
  method: 'get',
  path: '/packs-list',
  tags: ['Admin'],
  summary: 'List all packs',
  description: 'Get a list of all packs in the system (Admin only)',
  request: {
    query: z.object({
      limit: z.number().int().positive().max(100).default(100).optional(),
      offset: z.number().int().min(0).default(0).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Packs list retrieved successfully',
      content: {
        'application/json': {
          schema: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              description: z.string().nullable(),
              category: z.string(),
              isPublic: z.boolean().nullable(),
              createdAt: z.string().nullable(),
              userEmail: z.string().nullable(),
            }),
          ),
        },
      },
    },
    401: {
      description: 'Unauthorized - Admin access required',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

adminRoutes.openapi(getPacksListRoute, async (c) => {
  const db = createDb(c);

  try {
    const { limit = 100, offset = 0 } = c.req.query();
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
      .limit(Number(limit))
      .offset(Number(offset));

    const formattedPacks = packsList.map((pack) => ({
      ...pack,
      createdAt: pack.createdAt?.toISOString() || null,
    }));

    return c.json(formattedPacks);
  } catch (error) {
    console.error('Error fetching packs:', error);
    return c.json({ error: 'Failed to fetch packs' }, 500);
  }
});

const getCatalogListRoute = createRoute({
  method: 'get',
  path: '/catalog-list',
  tags: ['Admin'],
  summary: 'List catalog items',
  description: 'Get a list of catalog items (Admin only)',
  request: {
    query: z.object({
      limit: z.number().int().positive().max(100).default(25).optional(),
      offset: z.number().int().min(0).default(0).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Catalog items list retrieved successfully',
      content: {
        'application/json': {
          schema: z.array(
            z.object({
              id: z.number(),
              name: z.string(),
              categories: z.array(z.string()).nullable(),
              brand: z.string().nullable(),
              price: z.number().nullable(),
              weight: z.number().nullable(),
              weightUnit: z.string(),
              createdAt: z.string().nullable(),
            }),
          ),
        },
      },
    },
    401: {
      description: 'Unauthorized - Admin access required',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

adminRoutes.openapi(getCatalogListRoute, async (c) => {
  const db = createDb(c);

  try {
    const { limit = 25, offset = 0 } = c.req.query();
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
      .limit(Number(limit))
      .offset(Number(offset));

    const formattedItems = itemsList.map((item) => ({
      ...item,
      createdAt: item.createdAt?.toISOString() || null,
    }));

    return c.json(formattedItems);
  } catch (error) {
    console.error('Error fetching catalog items:', error);
    return c.json({ error: 'Failed to fetch catalog items' }, 500);
  }
});

export { adminRoutes };
