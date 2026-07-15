import { safeJsonStringify } from '@packrat/utils';
import { defineCommand } from 'citty';
import { getAdminClient } from '../../api/client';
import { requireAdmin, runApi } from '../../api/run';

function dump(value: unknown): void {
  process.stdout.write(`${safeJsonStringify(value, null, 2)}\n`);
}

const growthCmd = defineCommand({
  meta: { name: 'growth', description: 'Platform growth metrics.' },
  args: {
    period: { type: 'string', description: 'day | week | month' },
    range: { type: 'string', description: 'Numeric range' },
  },
  async run({ args }) {
    await requireAdmin();
    const client = await getAdminClient();
    const data = await runApi({
      promise: client.admin.analytics.platform.growth.get({
        query: {
          period: args.period as 'day' | 'week' | 'month' | undefined,
          range: args.range ? Number.parseInt(args.range, 10) : undefined,
        },
      }),
      action: 'admin growth analytics',
      requiresAdmin: true,
    });
    dump(data);
  },
});

const activityCmd = defineCommand({
  meta: { name: 'activity', description: 'Platform activity metrics.' },
  args: {
    period: { type: 'string' },
    range: { type: 'string' },
  },
  async run({ args }) {
    await requireAdmin();
    const client = await getAdminClient();
    const data = await runApi({
      promise: client.admin.analytics.platform.activity.get({
        query: {
          period: args.period as 'day' | 'week' | 'month' | undefined,
          range: args.range ? Number.parseInt(args.range, 10) : undefined,
        },
      }),
      action: 'admin activity analytics',
      requiresAdmin: true,
    });
    dump(data);
  },
});

const activeUsersCmd = defineCommand({
  meta: { name: 'active-users', description: 'DAU / WAU / MAU.' },
  async run() {
    await requireAdmin();
    const client = await getAdminClient();
    const data = await runApi({
      promise: client.admin.analytics.platform['active-users'].get(),
      action: 'admin active users',
      requiresAdmin: true,
    });
    dump(data);
  },
});

const breakdownCmd = defineCommand({
  meta: { name: 'breakdown', description: 'Packs by category distribution.' },
  async run() {
    await requireAdmin();
    const client = await getAdminClient();
    const data = await runApi({
      promise: client.admin.analytics.platform.breakdown.get(),
      action: 'admin breakdown',
      requiresAdmin: true,
    });
    dump(data);
  },
});

const catalogOverviewCmd = defineCommand({
  meta: { name: 'catalog-overview', description: 'Catalog-wide overview.' },
  async run() {
    await requireAdmin();
    const client = await getAdminClient();
    const data = await runApi({
      promise: client.admin.analytics.catalog.overview.get(),
      action: 'admin catalog overview',
      requiresAdmin: true,
    });
    dump(data);
  },
});

const brandsCmd = defineCommand({
  meta: { name: 'top-brands', description: 'Top gear brands.' },
  args: { limit: { type: 'string', default: '20' } },
  async run({ args }) {
    await requireAdmin();
    const client = await getAdminClient();
    const data = await runApi({
      promise: client.admin.analytics.catalog.brands.get({
        query: { limit: Number.parseInt(args.limit, 10) },
      }),
      action: 'admin top brands',
      requiresAdmin: true,
    });
    dump(data);
  },
});

const pricesCmd = defineCommand({
  meta: { name: 'prices', description: 'Catalog price distribution.' },
  async run() {
    await requireAdmin();
    const client = await getAdminClient();
    const data = await runApi({
      promise: client.admin.analytics.catalog.prices.get(),
      action: 'admin price distribution',
      requiresAdmin: true,
    });
    dump(data);
  },
});

const embeddingsCmd = defineCommand({
  meta: { name: 'embeddings', description: 'Embedding coverage stats.' },
  async run() {
    await requireAdmin();
    const client = await getAdminClient();
    const data = await runApi({
      promise: client.admin.analytics.catalog.embeddings.get(),
      action: 'admin embedding stats',
      requiresAdmin: true,
    });
    dump(data);
  },
});

export default defineCommand({
  meta: { name: 'analytics', description: 'Admin analytics dashboards.' },
  subCommands: {
    growth: () => Promise.resolve(growthCmd),
    activity: () => Promise.resolve(activityCmd),
    'active-users': () => Promise.resolve(activeUsersCmd),
    breakdown: () => Promise.resolve(breakdownCmd),
    'catalog-overview': () => Promise.resolve(catalogOverviewCmd),
    'top-brands': () => Promise.resolve(brandsCmd),
    prices: () => Promise.resolve(pricesCmd),
    embeddings: () => Promise.resolve(embeddingsCmd),
  },
});
