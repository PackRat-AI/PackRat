import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '@packrat/api/types/env';
import { catalogRoutes } from './catalog';
import { platformRoutes } from './platform';

export const analyticsRoutes = new OpenAPIHono<{ Bindings: Env }>();

// ─── Sub-routers ─────────────────────────────────────────────────────────────

analyticsRoutes.route('/platform', platformRoutes);
analyticsRoutes.route('/catalog', catalogRoutes);

// ─── HTML Dashboard ───────────────────────────────────────────────────────────

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

    <!-- Nav -->
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

    <!-- Main content -->
    <div class="bg-white/95 backdrop-blur-sm rounded-xl p-8 shadow-xl border border-white/20 space-y-10">

      <!-- Header + period control -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 class="text-2xl font-bold text-gray-800">Analytics Dashboard</h2>
        <div class="flex gap-2 items-center">
          <label class="text-sm text-gray-600 font-medium">Period:</label>
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

      <!-- ══ PLATFORM ════════════════════════════════════════════════════════ -->
      <section>
        <h3 class="text-lg font-semibold text-gray-700 border-b pb-2 mb-5">Platform</h3>

        <!-- Summary cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div class="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-5 rounded-xl shadow">
            <p class="text-3xl font-bold" id="card-users">–</p>
            <p class="text-sm opacity-90 mt-1">New users</p>
          </div>
          <div class="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white p-5 rounded-xl shadow">
            <p class="text-3xl font-bold" id="card-packs">–</p>
            <p class="text-sm opacity-90 mt-1">Packs created</p>
          </div>
          <div class="bg-gradient-to-r from-violet-500 to-violet-600 text-white p-5 rounded-xl shadow">
            <p class="text-3xl font-bold" id="card-catalog-added">–</p>
            <p class="text-sm opacity-90 mt-1">Catalog items added</p>
          </div>
          <div class="bg-gradient-to-r from-amber-500 to-amber-600 text-white p-5 rounded-xl shadow">
            <p class="text-3xl font-bold" id="card-trips">–</p>
            <p class="text-sm opacity-90 mt-1">Trips created</p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div class="border border-gray-200 rounded-xl p-5">
            <h4 class="text-sm font-semibold text-gray-600 mb-3">User Registrations</h4>
            <div class="relative h-52"><canvas id="chart-user-growth"></canvas></div>
          </div>
          <div class="border border-gray-200 rounded-xl p-5">
            <h4 class="text-sm font-semibold text-gray-600 mb-3">Content Creation (Packs &amp; Catalog)</h4>
            <div class="relative h-52"><canvas id="chart-content-growth"></canvas></div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="border border-gray-200 rounded-xl p-5">
            <h4 class="text-sm font-semibold text-gray-600 mb-3">Activity (Trips, Trail Reports, Posts)</h4>
            <div class="relative h-52"><canvas id="chart-activity"></canvas></div>
          </div>
          <div class="border border-gray-200 rounded-xl p-5">
            <h4 class="text-sm font-semibold text-gray-600 mb-3">Packs by Category</h4>
            <div class="relative h-52"><canvas id="chart-pack-categories"></canvas></div>
          </div>
        </div>
      </section>

      <!-- ══ DATA LAKE ══════════════════════════════════════════════════════ -->
      <section>
        <h3 class="text-lg font-semibold text-gray-700 border-b pb-2 mb-5">Gear Catalog</h3>

        <!-- Catalog overview cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div class="bg-gradient-to-r from-sky-500 to-sky-600 text-white p-5 rounded-xl shadow">
            <p class="text-3xl font-bold" id="card-catalog-total">–</p>
            <p class="text-sm opacity-90 mt-1">Total items</p>
          </div>
          <div class="bg-gradient-to-r from-teal-500 to-teal-600 text-white p-5 rounded-xl shadow">
            <p class="text-3xl font-bold" id="card-catalog-brands">–</p>
            <p class="text-sm opacity-90 mt-1">Brands</p>
          </div>
          <div class="bg-gradient-to-r from-rose-500 to-rose-600 text-white p-5 rounded-xl shadow">
            <p class="text-3xl font-bold" id="card-catalog-avg-price">–</p>
            <p class="text-sm opacity-90 mt-1">Avg price</p>
          </div>
          <div class="bg-gradient-to-r from-fuchsia-500 to-fuchsia-600 text-white p-5 rounded-xl shadow">
            <p class="text-3xl font-bold" id="card-embedding-pct">–</p>
            <p class="text-sm opacity-90 mt-1">Embedding coverage</p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div class="border border-gray-200 rounded-xl p-5">
            <h4 class="text-sm font-semibold text-gray-600 mb-3">Price Distribution</h4>
            <div class="relative h-52"><canvas id="chart-price-dist"></canvas></div>
          </div>
          <div class="border border-gray-200 rounded-xl p-5">
            <h4 class="text-sm font-semibold text-gray-600 mb-3">Availability Breakdown</h4>
            <div class="relative h-52"><canvas id="chart-availability"></canvas></div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div class="border border-gray-200 rounded-xl p-5">
            <h4 class="text-sm font-semibold text-gray-600 mb-3">Top Brands by Item Count</h4>
            <div class="relative h-64"><canvas id="chart-brands"></canvas></div>
          </div>
          <div class="border border-gray-200 rounded-xl p-5">
            <h4 class="text-sm font-semibold text-gray-600 mb-3">Embedding Coverage</h4>
            <div class="relative h-64"><canvas id="chart-embeddings"></canvas></div>
          </div>
        </div>

        <!-- ETL table -->
        <div class="border border-gray-200 rounded-xl p-5">
          <h4 class="text-sm font-semibold text-gray-600 mb-3">ETL Pipeline — Recent Runs</h4>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div class="bg-gray-50 rounded-lg p-3 text-center">
              <p class="text-xl font-bold text-gray-800" id="etl-total-runs">–</p>
              <p class="text-xs text-gray-500">Total runs</p>
            </div>
            <div class="bg-green-50 rounded-lg p-3 text-center">
              <p class="text-xl font-bold text-green-700" id="etl-completed">–</p>
              <p class="text-xs text-gray-500">Completed</p>
            </div>
            <div class="bg-red-50 rounded-lg p-3 text-center">
              <p class="text-xl font-bold text-red-700" id="etl-failed">–</p>
              <p class="text-xs text-gray-500">Failed</p>
            </div>
            <div class="bg-blue-50 rounded-lg p-3 text-center">
              <p class="text-xl font-bold text-blue-700" id="etl-ingested">–</p>
              <p class="text-xs text-gray-500">Items ingested</p>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b text-left text-gray-500">
                  <th class="pb-2 pr-4 font-medium">Source</th>
                  <th class="pb-2 pr-4 font-medium">Status</th>
                  <th class="pb-2 pr-4 font-medium">Processed</th>
                  <th class="pb-2 pr-4 font-medium">Valid</th>
                  <th class="pb-2 pr-4 font-medium">Success %</th>
                  <th class="pb-2 pr-4 font-medium">Revision</th>
                  <th class="pb-2 font-medium">Started</th>
                </tr>
              </thead>
              <tbody id="etl-table-body">
                <tr><td colspan="7" class="py-4 text-center text-gray-400">Loading…</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div id="status-bar" class="text-sm text-right text-gray-400 hidden"></div>
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
      const [y, m, d] = str.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d))
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit', timeZone: 'UTC' });
    }

    function fmtDateTime(iso) {
      return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function getRange(period) { return period === 'day' ? 30 : 12; }

    function makeChart(id, type, data, opts = {}) {
      if (charts[id]) charts[id].destroy();
      const ctx = document.getElementById(id).getContext('2d');
      charts[id] = new Chart(ctx, {
        type,
        data,
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
          scales: (type === 'bar' || type === 'line')
            ? { y: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } } }, x: { ticks: { font: { size: 10 } } } }
            : undefined,
          ...opts,
        },
      });
    }

    function align(series, labels) {
      const map = {};
      for (const r of series) map[r.date] = r.count;
      return labels.map(l => map[l] ?? 0);
    }

    function setCard(id, val) { document.getElementById(id).textContent = val; }
    function setStatus(msg, err = false) {
      const el = document.getElementById('status-bar');
      el.textContent = msg;
      el.className = 'text-sm text-right ' + (err ? 'text-red-500' : 'text-gray-400');
      el.classList.remove('hidden');
    }

    async function apiFetch(path) {
      const res = await fetch(path);
      if (!res.ok) throw new Error('HTTP ' + res.status + ' from ' + path);
      return res.json();
    }

    // ── Platform ──────────────────────────────────────────────────────────────

    async function loadPlatformGrowth(period) {
      const range = getRange(period);
      const data = await apiFetch('/api/admin/analytics/platform/growth?period=' + period + '&range=' + range);

      const allDates = [...new Set([
        ...data.users.map(r => r.date),
        ...data.packs.map(r => r.date),
        ...data.catalog.map(r => r.date),
      ])].sort();
      const labels = allDates.map(fmtDate);

      makeChart('chart-user-growth', 'line', {
        labels,
        datasets: [{ label: 'New users', data: align(data.users, allDates),
          borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.12)', fill: true, tension: 0.35, pointRadius: 3 }],
      }, { plugins: { legend: { display: false } } });

      makeChart('chart-content-growth', 'line', {
        labels,
        datasets: [
          { label: 'Packs created', data: align(data.packs, allDates),
            borderColor: '#10b981', fill: false, tension: 0.35, pointRadius: 3 },
          { label: 'Catalog items added', data: align(data.catalog, allDates),
            borderColor: '#8b5cf6', fill: false, tension: 0.35, pointRadius: 3 },
        ],
      });

      setCard('card-users', data.users.reduce((a, r) => a + r.count, 0).toLocaleString());
      setCard('card-packs', data.packs.reduce((a, r) => a + r.count, 0).toLocaleString());
      setCard('card-catalog-added', data.catalog.reduce((a, r) => a + r.count, 0).toLocaleString());
    }

    async function loadPlatformActivity(period) {
      const range = getRange(period);
      const data = await apiFetch('/api/admin/analytics/platform/activity?period=' + period + '&range=' + range);

      const allDates = [...new Set([
        ...data.trips.map(r => r.date),
        ...data.trailReports.map(r => r.date),
        ...data.posts.map(r => r.date),
      ])].sort();
      const labels = allDates.map(fmtDate);

      makeChart('chart-activity', 'line', {
        labels,
        datasets: [
          { label: 'Trips', data: align(data.trips, allDates), borderColor: '#f59e0b', fill: false, tension: 0.35, pointRadius: 3 },
          { label: 'Trail reports', data: align(data.trailReports, allDates), borderColor: '#ef4444', fill: false, tension: 0.35, pointRadius: 3 },
          { label: 'Posts', data: align(data.posts, allDates), borderColor: '#06b6d4', fill: false, tension: 0.35, pointRadius: 3 },
        ],
      });

      setCard('card-trips', data.trips.reduce((a, r) => a + r.count, 0).toLocaleString());
    }

    async function loadPlatformBreakdown() {
      const data = await apiFetch('/api/admin/analytics/platform/breakdown');
      const cats = data.packsByCategory.slice(0, 15);
      makeChart('chart-pack-categories', 'bar', {
        labels: cats.map(r => r.category || 'Uncategorized'),
        datasets: [{ label: 'Packs', data: cats.map(r => r.count), backgroundColor: PALETTE }],
      }, { plugins: { legend: { display: false } } });
    }

    // ── Catalog / Data Lake ────────────────────────────────────────────────────

    async function loadCatalogOverview() {
      const data = await apiFetch('/api/admin/analytics/catalog/overview');

      setCard('card-catalog-total', data.totalItems.toLocaleString());
      setCard('card-catalog-brands', data.totalBrands.toLocaleString());
      setCard('card-catalog-avg-price', data.avgPrice != null ? '$' + data.avgPrice.toFixed(2) : '–');
      setCard('card-embedding-pct', data.embeddingCoverage.pct + '%');

      // Availability pie
      makeChart('chart-availability', 'doughnut', {
        labels: data.availability.map(r => r.status || 'Unknown'),
        datasets: [{ data: data.availability.map(r => r.count), backgroundColor: PALETTE }],
      }, { plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } } });
    }

    async function loadCatalogBrands() {
      const data = await apiFetch('/api/admin/analytics/catalog/brands?limit=20');
      makeChart('chart-brands', 'bar', {
        labels: data.map(r => r.brand),
        datasets: [{ label: 'Items', data: data.map(r => r.itemCount), backgroundColor: PALETTE }],
      }, { indexAxis: 'y', plugins: { legend: { display: false } } });
    }

    async function loadCatalogPrices() {
      const data = await apiFetch('/api/admin/analytics/catalog/prices');
      makeChart('chart-price-dist', 'bar', {
        labels: data.map(r => r.bucket),
        datasets: [{ label: 'Items', data: data.map(r => r.count), backgroundColor: PALETTE }],
      }, { plugins: { legend: { display: false } } });
    }

    async function loadCatalogEmbeddings() {
      const data = await apiFetch('/api/admin/analytics/catalog/embeddings');
      makeChart('chart-embeddings', 'doughnut', {
        labels: ['With embedding', 'Pending'],
        datasets: [{ data: [data.withEmbedding, data.pending], backgroundColor: ['#10b981', '#e5e7eb'] }],
      }, {
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: ctx => ctx.label + ': ' + ctx.parsed.toLocaleString() + ' (' + data.coveragePct + '%)',
            },
          },
        },
      });
    }

    async function loadCatalogEtl() {
      const data = await apiFetch('/api/admin/analytics/catalog/etl?limit=20');

      setCard('etl-total-runs', data.summary.totalRuns.toLocaleString());
      setCard('etl-completed', data.summary.completed.toLocaleString());
      setCard('etl-failed', data.summary.failed.toLocaleString());
      setCard('etl-ingested', data.summary.totalItemsIngested.toLocaleString());

      const statusColor = { completed: 'text-green-600', failed: 'text-red-600', running: 'text-amber-600' };
      const tbody = document.getElementById('etl-table-body');
      tbody.innerHTML = data.jobs.length === 0
        ? '<tr><td colspan="7" class="py-4 text-center text-gray-400">No ETL runs found</td></tr>'
        : data.jobs.map(j => \`
          <tr class="border-b border-gray-100 hover:bg-gray-50">
            <td class="py-2 pr-4 font-medium text-gray-800">\${j.source}</td>
            <td class="py-2 pr-4 \${statusColor[j.status] || ''} font-medium">\${j.status}</td>
            <td class="py-2 pr-4 text-gray-600">\${j.totalProcessed?.toLocaleString() ?? '–'}</td>
            <td class="py-2 pr-4 text-gray-600">\${j.totalValid?.toLocaleString() ?? '–'}</td>
            <td class="py-2 pr-4 text-gray-600">\${j.successRate != null ? j.successRate + '%' : '–'}</td>
            <td class="py-2 pr-4 font-mono text-xs text-gray-500">\${j.scraperRevision.slice(0, 8)}</td>
            <td class="py-2 text-gray-500 text-xs">\${fmtDateTime(j.startedAt)}</td>
          </tr>
        \`).join('');
    }

    // ── Bootstrap ─────────────────────────────────────────────────────────────

    async function loadAll() {
      const period = document.getElementById('period-select').value;
      setStatus('Loading…');
      try {
        await Promise.all([
          loadPlatformGrowth(period),
          loadPlatformActivity(period),
          loadPlatformBreakdown(),
          loadCatalogOverview(),
          loadCatalogBrands(),
          loadCatalogPrices(),
          loadCatalogEmbeddings(),
          loadCatalogEtl(),
        ]);
        setStatus('Updated ' + new Date().toLocaleTimeString());
      } catch (err) {
        console.error(err);
        setStatus('Error: ' + err.message, true);
      }
    }

    document.getElementById('period-select').addEventListener('change', () => {
      // Only reload platform data when period changes — catalog data is not time-scoped
      const period = document.getElementById('period-select').value;
      Promise.all([
        loadPlatformGrowth(period),
        loadPlatformActivity(period),
      ]).catch(console.error);
    });

    window.addEventListener('load', loadAll);
  </script>
</body>
</html>`;

analyticsRoutes.get('/', (c) => c.html(DASHBOARD_HTML));
