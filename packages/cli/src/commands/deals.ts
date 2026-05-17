import { defineCommand } from 'citty';
import { parseCsvArg, parseNonNegativeNumberArg, parsePositiveIntArg } from '../args';
import { ensureCache, printTable } from '../shared';

export default defineCommand({
  meta: { name: 'deals', description: 'Find deals under a price threshold' },
  args: {
    'max-price': { type: 'string', alias: 'p', description: 'Maximum price', default: '100' },
    category: { type: 'string', alias: 'c', description: 'Category filter' },
    sites: { type: 'string', alias: 's', description: 'Comma-separated sites' },
    limit: { type: 'string', alias: 'l', description: 'Result limit', default: '20' },
  },
  async run({ args }) {
    const cache = await ensureCache();
    const maxPrice = parseNonNegativeNumberArg({
      value: args['max-price'],
      argName: '--max-price',
    });
    const rows = await cache.findDeals({
      maxPrice,
      options: {
        category: args.category,
        sites: parseCsvArg(args.sites),
        limit: parsePositiveIntArg({ value: args.limit, argName: '--limit' }),
      },
    });
    printTable({
      rows: rows.map(({ site, name, brand, price, category }) => ({
        site,
        name: name.slice(0, 50),
        brand,
        price,
        category,
      })),
      options: {
        title: `Deals under $${maxPrice}`,
      },
    });
  },
});
