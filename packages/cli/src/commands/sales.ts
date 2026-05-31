import { defineCommand } from 'citty';
import { parseCsvArg, parsePercentageArg, parsePositiveIntArg } from '../args';
import { ensureCache, printTable } from '../shared';

export default defineCommand({
  meta: { name: 'sales', description: 'Find items on sale' },
  args: {
    'min-discount': { type: 'string', alias: 'd', description: 'Min discount %', default: '10' },
    category: { type: 'string', alias: 'c', description: 'Category filter' },
    sites: { type: 'string', alias: 's', description: 'Comma-separated sites' },
    limit: { type: 'string', alias: 'l', description: 'Result limit', default: '20' },
  },
  async run({ args }) {
    const cache = await ensureCache();
    const rows = await cache.findSales({
      minDiscountPct: parsePercentageArg({
        value: args['min-discount'],
        argName: '--min-discount',
      }),
      category: args.category,
      sites: parseCsvArg(args.sites),
      limit: parsePositiveIntArg({ value: args.limit, argName: '--limit' }),
    });
    printTable({
      rows: rows.map(({ site, name, price, compare_at_price, discount_pct }) => ({
        site,
        name: String(name).slice(0, 40),
        price,
        was: compare_at_price,
        'off%': discount_pct,
      })),
      options: { title: 'Items on Sale' },
    });
  },
});
