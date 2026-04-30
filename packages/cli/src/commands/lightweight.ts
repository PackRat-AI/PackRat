import { defineCommand } from 'citty';
import { parseCsvArg, parseNonNegativeNumberArg, parsePositiveIntArg } from '../args';
import { ensureCache, printTable } from '../shared';

export default defineCommand({
  meta: { name: 'lightweight', description: 'Find lightweight gear' },
  args: {
    category: { type: 'string', alias: 'c', description: 'Category filter' },
    'max-weight': {
      type: 'string',
      alias: 'w',
      description: 'Max weight in grams',
      default: '500',
    },
    sites: { type: 'string', alias: 's', description: 'Comma-separated sites' },
    limit: { type: 'string', alias: 'l', description: 'Result limit', default: '20' },
  },
  async run({ args }) {
    const cache = await ensureCache();
    const maxWeight = parseNonNegativeNumberArg(args['max-weight'], '--max-weight');
    const rows = await cache.findLightweight({
      category: args.category,
      maxWeightG: maxWeight,
      sites: parseCsvArg(args.sites),
      limit: parsePositiveIntArg(args.limit, '--limit'),
    });
    printTable(
      rows.map(({ site, name, brand, weight_g, price, weight_per_dollar }) => ({
        site,
        name: String(name).slice(0, 40),
        brand,
        'wt(g)': weight_g,
        price,
        'g/$': weight_per_dollar,
      })),
      { title: `Lightweight Gear (≤${maxWeight}g)` },
    );
  },
});
