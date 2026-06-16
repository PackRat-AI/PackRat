import { defineCommand } from 'citty';
import { parseCsvArg, parseOptionalNumberArg, parsePositiveIntArg } from '../args';
import { ensureCache, printTable } from '../shared';

export default defineCommand({
  meta: { name: 'search', description: 'Search for gear across all sites' },
  args: {
    keyword: { type: 'positional', description: 'Search keyword', required: true },
    'max-price': { type: 'string', alias: 'p', description: 'Maximum price' },
    'min-price': { type: 'string', description: 'Minimum price' },
    sites: { type: 'string', alias: 's', description: 'Comma-separated sites' },
    limit: { type: 'string', alias: 'l', description: 'Result limit', default: '20' },
  },
  async run({ args }) {
    const cache = await ensureCache();
    const limit = parsePositiveIntArg({ value: args.limit, argName: '--limit' });
    const rows = await cache.search({
      keyword: args.keyword,
      options: {
        maxPrice: parseOptionalNumberArg({ value: args['max-price'], argName: '--max-price' }),
        minPrice: parseOptionalNumberArg({ value: args['min-price'], argName: '--min-price' }),
        sites: parseCsvArg(args.sites),
        limit,
      },
    });
    printTable({
      rows: rows.map(({ site, name, brand, price }) => ({
        site,
        name: name.slice(0, 50),
        brand,
        price,
      })),
      options: {
        title: `Search: "${args.keyword}"`,
      },
    });
  },
});
