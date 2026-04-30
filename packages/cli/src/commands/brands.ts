import { defineCommand } from 'citty';
import { parsePositiveIntArg } from '../args';
import { ensureCache, printTable } from '../shared';

export default defineCommand({
  meta: { name: 'brands', description: 'Top brands by product count' },
  args: {
    site: { type: 'string', alias: 's', description: 'Filter to site' },
    limit: { type: 'string', alias: 'l', description: 'Result limit', default: '20' },
  },
  async run({ args }) {
    const cache = await ensureCache();
    const rows = await cache.getTopBrands(parsePositiveIntArg(args.limit, '--limit'), args.site);
    printTable(rows, { title: 'Top Brands' });
  },
});
