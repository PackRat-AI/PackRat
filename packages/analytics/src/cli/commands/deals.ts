import { defineCommand } from 'citty';
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
    const rows = await cache.findDeals(Number(args['max-price']), {
      category: args.category,
      sites: args.sites?.split(','),
      limit: Number(args.limit),
    });
    printTable(
      rows.map(({ site, name, brand, price, category }) => ({
        site,
        name: name.slice(0, 50),
        brand,
        price,
        category,
      })),
      {
        title: `Deals under $${args['max-price']}`,
      },
    );
  },
});
