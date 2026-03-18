import { defineCommand } from 'citty';
import { ensureCache, printTable } from '../shared';

export default defineCommand({
  meta: { name: 'trends', description: 'Price trends over time' },
  args: {
    keyword: { type: 'positional', description: 'Product keyword', required: true },
    days: { type: 'string', alias: 'd', description: 'Lookback days', default: '90' },
    site: { type: 'string', alias: 's', description: 'Filter to specific site' },
  },
  async run({ args }) {
    const days = Number.parseInt(String(args.days), 10);
    if (!Number.isFinite(days) || days <= 0) {
      throw new Error(`Invalid --days value: "${args.days}". Must be a positive integer.`);
    }
    const cache = await ensureCache();
    const rows = await cache.searchTrends(args.keyword, {
      site: args.site,
      days,
    });
    printTable(rows as unknown as Record<string, unknown>[], {
      title: `Price Trends: "${args.keyword}"`,
    });
  },
});
