import { defineCommand } from 'citty';
import { parseCsvArg } from '../args';
import { ensureCache, printTable } from '../shared';

export default defineCommand({
  meta: { name: 'category', description: 'Category insights across sites' },
  args: {
    name: { type: 'positional', description: 'Category keyword', required: true },
    sites: { type: 'string', alias: 's', description: 'Comma-separated sites' },
  },
  async run({ args }) {
    const cache = await ensureCache();
    const rows = await cache.categoryInsights(args.name, parseCsvArg(args.sites));
    printTable(rows, { title: `Category: "${args.name}"` });
  },
});
