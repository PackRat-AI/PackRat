import { defineCommand } from 'citty';
import { parsePositiveIntArg } from '../args';
import { ensureCache, printTable } from '../shared';

export default defineCommand({
  meta: { name: 'trends', description: 'Price trends over time' },
  args: {
    keyword: { type: 'positional', description: 'Product keyword', required: true },
    days: { type: 'string', alias: 'd', description: 'Lookback days', default: '90' },
    site: { type: 'string', alias: 's', description: 'Filter to specific site' },
  },
  async run({ args }) {
    const days = parsePositiveIntArg(args.days, '--days');
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
