import { defineCommand } from 'citty';
import { parseCsvArg, parseNonNegativeNumberArg, parsePositiveIntArg } from '../args';
import { ensureCache, printTable } from '../shared';

export default defineCommand({
  meta: { name: 'ratings', description: 'Find highest-rated products' },
  args: {
    category: { type: 'string', alias: 'c', description: 'Category filter' },
    'min-reviews': { type: 'string', alias: 'r', description: 'Min review count', default: '5' },
    sites: { type: 'string', alias: 's', description: 'Comma-separated sites' },
    limit: { type: 'string', alias: 'l', description: 'Result limit', default: '20' },
  },
  async run({ args }) {
    const cache = await ensureCache();
    const rows = await cache.getTopRated({
      category: args.category,
      minReviews: parseNonNegativeNumberArg(args['min-reviews'], '--min-reviews'),
      sites: parseCsvArg(args.sites),
      limit: parsePositiveIntArg(args.limit, '--limit'),
    });
    printTable(
      rows.map(({ site, name, brand, rating_value, review_count, price, score }) => ({
        site,
        name: String(name).slice(0, 40),
        brand,
        rating: rating_value,
        reviews: review_count,
        price,
        score,
      })),
      { title: 'Top Rated Products' },
    );
  },
});
