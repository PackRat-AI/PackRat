import { defineCommand } from 'citty';
import { ensureCache, printTable } from '../shared';

export default defineCommand({
  meta: { name: 'prices', description: 'Price distribution breakdown' },
  args: {
    site: { type: 'string', alias: 's', description: 'Filter to site' },
  },
  async run({ args }) {
    const cache = await ensureCache();
    const rows = await cache.getPriceDistribution(args.site);
    printTable(rows as unknown as Record<string, unknown>[], { title: 'Price Distribution' });
  },
});
