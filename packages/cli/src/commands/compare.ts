import { defineCommand } from 'citty';
import { parseCsvArg } from '../args';
import { ensureCache, printTable } from '../shared';

export default defineCommand({
  meta: { name: 'compare', description: 'Compare prices across retailers' },
  args: {
    keyword: { type: 'positional', description: 'Product keyword', required: true },
    sites: { type: 'string', alias: 's', description: 'Comma-separated sites' },
  },
  async run({ args }) {
    const cache = await ensureCache();
    const rows = await cache.comparePrices(args.keyword, parseCsvArg(args.sites));
    printTable(rows, {
      title: `Price Comparison: "${args.keyword}"`,
    });
  },
});
