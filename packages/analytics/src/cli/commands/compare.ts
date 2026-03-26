import { defineCommand } from 'citty';
import { ensureCache, printTable } from '../shared';

export default defineCommand({
  meta: { name: 'compare', description: 'Compare prices across retailers' },
  args: {
    keyword: { type: 'positional', description: 'Product keyword', required: true },
    sites: { type: 'string', alias: 's', description: 'Comma-separated sites' },
  },
  async run({ args }) {
    const cache = await ensureCache();
    const rows = await cache.comparePrices(args.keyword, args.sites?.split(','));
    printTable(rows as unknown as Record<string, unknown>[], {
      title: `Price Comparison: "${args.keyword}"`,
    });
  },
});
