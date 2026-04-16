import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import {
  catalogItems,
  packItems,
  packs,
  posts,
  trailConditionReports,
  trips,
  users,
} from '@packrat/api/db/schema';
import { ErrorResponseSchema } from '@packrat/api/schemas/catalog';
import type { Env } from '@packrat/api/types/env';
import { and, count, desc, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';

export const platformRoutes = new OpenAPIHono<{ Bindings: Env }>();

// ─── Schemas ────────────────────────────────────────────────────────────────

const PeriodSchema = z.object({
  period: z.enum(['day', 'week', 'month']).optional().default('month'),
  range: z.coerce.number().int().min(1).max(365).optional().default(12),
});

const TimeSeriesPoint = z.object({ date: z.string(), count: z.number() });
const CategoryBreakdown = z.object({ category: z.string().nullable(), count: z.number() });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStartDate(period: 'day' | 'week' | 'month', range: number): Date {
  const d = new Date();
  if (period === 'day') d.setDate(d.getDate() - range);
  else if (period === 'week') d.setDate(d.getDate() - range * 7);
  else d.setMonth(d.getMonth() - range);
  return d;
}

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Analytics - PackRat Admin</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script>
    tailwind.config = {
      theme: { extend: { colors: { primary: '#667eea', secondary: '#764ba2' } } }
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
        <a href="/api/admin/analytics" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold ring-2 ring-indigo-300">Analytics</a>
      </nav>
    </div>

    <div class="bg-white/95 backdrop-blur-sm rounded-xl p-8 shadow-xl border border-white/20 space-y-8">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 class="text-2xl font-bold text-gray-800">Analytics Dashboard</h2>
        <div class="flex gap-2 items-center">
          <label class="text-sm text-gray-600 font-medium">View:</label>
          <select id="period-select"
            class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="day">Daily — last 30 days</option>
            <option value="week">Weekly — last 12 weeks</option>
            <option value="month" selected>Monthly — last 12 months</option>
          </select>
          <button onclick="loadAll()"
            class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
            Refresh
          </button>
        </div>
      </div>

      <!-- Summary cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-5 rounded-xl shadow">
          <p class="text-3xl font-bold" id="card-users">–</p>
          <p class="text-sm opacity-90 mt-1">Users (period)</p>
        </div>
        <div class="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white p-5 rounded-xl shadow">
          <p class="text-3xl font-bold" id="card-packs">–</p>
          <p class="text-sm opacity-90 mt-1">Packs (period)</p>
        </div>
        <div class="bg-gradient-to-r from-violet-500 to-violet-600 text-white p-5 rounded-xl shadow">
          <p class="text-3xl font-bold" id="card-catalog">–</p>
          <p class="text-sm opacity-90 mt-1">Catalog items (period)</p>
        </div>
        <div class="bg-gradient-to-r from-amber-500 to-amber-600 text-white p-5 rounded-xl shadow">
          <p class="text-3xl font-bold" id="card-trips">–</p>
          <p class="text-sm opacity-90 mt-1">Trips (period)</p>
        </div>
      </div>

      <!-- Growth charts -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="border border-gray-200 rounded-xl p-5">
          <h3 class="text-base font-semibold text-gray-700 mb-4">User Registrations</h3>
          <div class="relative h-56"><canvas id="chart-user-growth"></canvas></div>
        </div>
        <div class="border border-gray-200 rounded-xl p-5">
          <h3 class="text-base font-semibold text-gray-700 mb-4">Content Creation (Packs &amp; Catalog)</h3>
          <div class="relative h-56"><canvas id="chart-content-growth"></canvas></div>
        </div>
      </div>

      <!-- Activity + Breakdown charts -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="border border-gray-200 rounded-xl p-5">
          <h3 class="text-base font-semibold text-gray-700 mb-4">Activity (Trips, Trail Reports, Posts)</h3>
          <div class="relative h-56"><canvas id="chart-activity"></canvas></div>
        </div>
        <div class="border border-gray-200 rounded-xl p-5">
          <h3 class="text-base font-semibold text-gray-700 mb-4">Packs by Category</h3>
          <div class="relative h-56"><canvas id="chart-categories"></canvas></div>
        </div>
      </div>

      <!-- Item categories -->
      <div class="border border-gray-200 rounded-xl p-5">
        <h3 class="text-base font-semibold text-gray-700 mb-4">Pack Items by Category (top 15)</h3>
        <div class="relative h-56"><canvas id="chart-item-categories"></canvas></div>
      </div>

      <!-- Loading / error state -->
      <div id="status-bar" class="text-sm text-gray-500 text-right hidden"></div>
    </div>
  </div>

  <script>
    const PALETTE = [
      '#3b82f6','#10b981','#8b5cf6','#f59e0b','#ef4444',
      '#06b6d4','#84cc16','#f97316','#ec4899','#6366f1',
      '#14b8a6','#a855f7','#fb923c','#22d3ee','#facc15',
    ];

    const charts = {};

    function fmtDate(str) {
      // str is YYYY-MM-DD from postgres ::date::text
      const [y, m, d] = str.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d))
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit', timeZone: 'UTC' });
    }

    function getRange(period) {
      return period === 'day' ? 30 : 12;
    }

    function makeChart(id, type, data, opts = {}) {
      if (charts[id]) charts[id].destroy();
      const ctx = document.getElementById(id).getContext('2d');
      charts[id] = new Chart(ctx, {
        type,
        data,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
          scales: type === 'bar' || type === 'line'
            ? { y: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } } }, x: { ticks: { font: { size: 10 } } } }
            : undefined,
          ...opts,
        },
      });
    }

    // Align a sparse series to a full label list, filling gaps with 0
    function align(series, labels) {
      const map = {};
      for (const r of series) map[r.date] = r.count;
      return labels.map(l => map[l] ?? 0);
    }

    function setCard(id, val) {
      document.getElementById(id).textContent = Number(val).toLocaleString();
    }

    function setStatus(msg, isError = false) {
      const el = document.getElementById('status-bar');
      el.textContent = msg;
      el.className = 'text-sm text-right ' + (isError ? 'text-red-500' : 'text-gray-400');
      el.classList.remove('hidden');
    }

    async function apiFetch(path) {
      const res = await fetch(path);
      if (!res.ok) throw new Error('HTTP ' + res.status + ' from ' + path);
      return res.json();
    }

    async function loadGrowth(period) {
      const range = getRange(period);
      const data = await apiFetch('/api/admin/analytics/growth?period=' + period + '&range=' + range);

      // Unified date labels for both charts
      const allDates = [...new Set([
        ...data.users.map(r => r.date),
        ...data.packs.map(r => r.date),
        ...data.catalog.map(r => r.date),
      ])].sort();

      const labels = allDates.map(fmtDate);

      makeChart('chart-user-growth', 'line', {
        labels,
        datasets: [{
          label: 'New users',
          data: align(data.users, allDates),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.12)',
          fill: true,
          tension: 0.35,
          pointRadius: 3,
        }],
      }, { plugins: { legend: { display: false } } });

      makeChart('chart-content-growth', 'line', {
        labels,
        datasets: [
          {
            label: 'Packs created',
            data: align(data.packs, allDates),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16,185,129,0.08)',
            fill: false,
            tension: 0.35,
            pointRadius: 3,
          },
          {
            label: 'Catalog items added',
            data: align(data.catalog, allDates),
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139,92,246,0.08)',
            fill: false,
            tension: 0.35,
            pointRadius: 3,
          },
        ],
      });

      setCard('card-users', data.users.reduce((a, r) => a + r.count, 0));
      setCard('card-packs', data.packs.reduce((a, r) => a + r.count, 0));
      setCard('card-catalog', data.catalog.reduce((a, r) => a + r.count, 0));
    }

    async function loadActivity(period) {
      const range = getRange(period);
      const data = await apiFetch('/api/admin/analytics/activity?period=' + period + '&range=' + range);

      const allDates = [...new Set([
        ...data.trips.map(r => r.date),
        ...data.trailReports.map(r => r.date),
        ...data.posts.map(r => r.date),
      ])].sort();

      const labels = allDates.map(fmtDate);

      makeChart('chart-activity', 'line', {
        labels,
        datasets: [
          {
            label: 'Trips',
            data: align(data.trips, allDates),
            borderColor: '#f59e0b',
            fill: false,
            tension: 0.35,
            pointRadius: 3,
          },
          {
            label: 'Trail reports',
            data: align(data.trailReports, allDates),
            borderColor: '#ef4444',
            fill: false,
            tension: 0.35,
            pointRadius: 3,
          },
          {
            label: 'Posts',
            data: align(data.posts, allDates),
            borderColor: '#06b6d4',
            fill: false,
            tension: 0.35,
            pointRadius: 3,
          },
        ],
      });

      setCard('card-trips', data.trips.reduce((a, r) => a + r.count, 0));
    }

    async function loadBreakdown() {
      const data = await apiFetch('/api/admin/analytics/breakdown');

      const packCats = data.packsByCategory.slice(0, 15);
      makeChart('chart-categories', 'bar', {
        labels: packCats.map(r => r.category || 'Uncategorized'),
        datasets: [{
          label: 'Packs',
          data: packCats.map(r => r.count),
          backgroundColor: PALETTE,
        }],
      }, { plugins: { legend: { display: false } } });

      const itemCats = data.itemsByCategory.slice(0, 15);
      makeChart('chart-item-categories', 'bar', {
        labels: itemCats.map(r => r.category || 'Uncategorized'),
        datasets: [{
          label: 'Pack items',
          data: itemCats.map(r => r.count),
          backgroundColor: PALETTE,
        }],
      }, { plugins: { legend: { display: false } } });
    }

    async function loadAll() {
      const period = document.getElementById('period-select').value;
      setStatus('Loading…');
      try {
        await Promise.all([loadGrowth(period), loadActivity(period), loadBreakdown()]);
        setStatus('Updated ' + new Date().toLocaleTimeString());
      } catch (err) {
        console.error(err);
        setStatus('Error loading data: ' + err.message, true);
      }
    }

    document.getElementById('period-select').addEventListener('change', loadAll);
    window.addEventListener('load', loadAll);
  </script>
</body>
</html>`;

// ─── HTML Dashboard ──────────────────────────────────────────────────────────

analyticsRoutes.get('/', (c) => c.html(DASHBOARD_HTML));

// ─── GET /growth ─────────────────────────────────────────────────────────────

const getGrowthRoute = createRoute({
  method: 'get',
  path: '/growth',
  tags: ['Admin'],
  summary: 'Platform growth metrics',
  description:
    'Time-series data for user registrations, pack creation, and catalog item additions (Admin only)',
  request: { query: PeriodSchema },
  responses: {
    200: {
      description: 'Growth time-series data',
      content: {
        'application/json': {
          schema: z.object({
            period: z.enum(['day', 'week', 'month']),
            range: z.number(),
            users: z.array(TimeSeriesPoint),
            packs: z.array(TimeSeriesPoint),
            catalog: z.array(TimeSeriesPoint),
          }),
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

analyticsRoutes.openapi(getGrowthRoute, async (c) => {
  const db = createDb(c);
  const { period = 'month', range = 12 } = c.req.valid('query');
  const startDate = getStartDate(period, range);

  try {
    const [userGrowth, packGrowth, catalogGrowth] = await Promise.all([
      db
        .select({
          date: sql<string>`date_trunc(${period}, ${users.createdAt})::date::text`,
          count: count(),
        })
        .from(users)
        .where(gte(users.createdAt, startDate))
        .groupBy(sql`date_trunc(${period}, ${users.createdAt})`)
        .orderBy(sql`date_trunc(${period}, ${users.createdAt})`),

      db
        .select({
          date: sql<string>`date_trunc(${period}, ${packs.createdAt})::date::text`,
          count: count(),
        })
        .from(packs)
        .where(and(eq(packs.deleted, false), gte(packs.createdAt, startDate)))
        .groupBy(sql`date_trunc(${period}, ${packs.createdAt})`)
        .orderBy(sql`date_trunc(${period}, ${packs.createdAt})`),

      db
        .select({
          date: sql<string>`date_trunc(${period}, ${catalogItems.createdAt})::date::text`,
          count: count(),
        })
        .from(catalogItems)
        .where(gte(catalogItems.createdAt, startDate))
        .groupBy(sql`date_trunc(${period}, ${catalogItems.createdAt})`)
        .orderBy(sql`date_trunc(${period}, ${catalogItems.createdAt})`),
    ]);

    return c.json(
      { period, range, users: userGrowth, packs: packGrowth, catalog: catalogGrowth },
      200,
    );
  } catch (error) {
    console.error('Analytics growth error:', error);
    return c.json({ error: 'Failed to fetch growth data', code: 'ANALYTICS_GROWTH_ERROR' }, 500);
  }
});

// ─── GET /activity ───────────────────────────────────────────────────────────

const getActivityRoute = createRoute({
  method: 'get',
  path: '/activity',
  tags: ['Admin'],
  summary: 'User activity metrics',
  description:
    'Time-series data for trips created, trail condition reports, and social posts (Admin only)',
  request: { query: PeriodSchema },
  responses: {
    200: {
      description: 'Activity time-series data',
      content: {
        'application/json': {
          schema: z.object({
            period: z.enum(['day', 'week', 'month']),
            range: z.number(),
            trips: z.array(TimeSeriesPoint),
            trailReports: z.array(TimeSeriesPoint),
            posts: z.array(TimeSeriesPoint),
          }),
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

analyticsRoutes.openapi(getActivityRoute, async (c) => {
  const db = createDb(c);
  const { period = 'month', range = 12 } = c.req.valid('query');
  const startDate = getStartDate(period, range);

  try {
    const [tripActivity, trailActivity, postActivity] = await Promise.all([
      db
        .select({
          date: sql<string>`date_trunc(${period}, ${trips.createdAt})::date::text`,
          count: count(),
        })
        .from(trips)
        .where(and(eq(trips.deleted, false), gte(trips.createdAt, startDate)))
        .groupBy(sql`date_trunc(${period}, ${trips.createdAt})`)
        .orderBy(sql`date_trunc(${period}, ${trips.createdAt})`),

      db
        .select({
          date: sql<string>`date_trunc(${period}, ${trailConditionReports.createdAt})::date::text`,
          count: count(),
        })
        .from(trailConditionReports)
        .where(
          and(
            eq(trailConditionReports.deleted, false),
            gte(trailConditionReports.createdAt, startDate),
          ),
        )
        .groupBy(sql`date_trunc(${period}, ${trailConditionReports.createdAt})`)
        .orderBy(sql`date_trunc(${period}, ${trailConditionReports.createdAt})`),

      db
        .select({
          date: sql<string>`date_trunc(${period}, ${posts.createdAt})::date::text`,
          count: count(),
        })
        .from(posts)
        .where(gte(posts.createdAt, startDate))
        .groupBy(sql`date_trunc(${period}, ${posts.createdAt})`)
        .orderBy(sql`date_trunc(${period}, ${posts.createdAt})`),
    ]);

    return c.json(
      { period, range, trips: tripActivity, trailReports: trailActivity, posts: postActivity },
      200,
    );
  } catch (error) {
    console.error('Analytics activity error:', error);
    return c.json(
      { error: 'Failed to fetch activity data', code: 'ANALYTICS_ACTIVITY_ERROR' },
      500,
    );
  }
});

// ─── GET /breakdown ──────────────────────────────────────────────────────────

const getBreakdownRoute = createRoute({
  method: 'get',
  path: '/breakdown',
  tags: ['Admin'],
  summary: 'Categorical distribution metrics',
  description:
    'Breakdown of packs and pack items by category, ordered by count descending (Admin only)',
  responses: {
    200: {
      description: 'Breakdown data',
      content: {
        'application/json': {
          schema: z.object({
            packsByCategory: z.array(CategoryBreakdown),
            itemsByCategory: z.array(CategoryBreakdown),
          }),
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

analyticsRoutes.openapi(getBreakdownRoute, async (c) => {
  const db = createDb(c);

  try {
    const [packsByCategory, itemsByCategory] = await Promise.all([
      db
        .select({ category: packs.category, count: count() })
        .from(packs)
        .where(eq(packs.deleted, false))
        .groupBy(packs.category)
        .orderBy(desc(count())),

      db
        .select({ category: packItems.category, count: count() })
        .from(packItems)
        .where(eq(packItems.deleted, false))
        .groupBy(packItems.category)
        .orderBy(desc(count())),
    ]);

    return c.json({ packsByCategory, itemsByCategory }, 200);
  } catch (error) {
    console.error('Analytics breakdown error:', error);
    return c.json(
      { error: 'Failed to fetch breakdown data', code: 'ANALYTICS_BREAKDOWN_ERROR' },
      500,
    );
  }
});
