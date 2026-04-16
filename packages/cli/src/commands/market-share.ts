import { defineCommand } from 'citty';
import { ensureCache, printTable } from '../shared';

export default defineCommand({
  meta: { name: 'market-share', description: 'Brand market share analysis' },
  args: {
    category: { type: 'string', alias: 'c', description: 'Category filter' },
    top: { type: 'string', alias: 't', description: 'Top N brands', default: '15' },
  },
  async run({ args }) {
    const cache = await ensureCache();
    const rows = await cache.getMarketShare({
      category: args.category,
      topN: Number(args.top),
    });
    printTable(rows as unknown as Record<string, unknown>[], { title: 'Market Share' });
  },
});
