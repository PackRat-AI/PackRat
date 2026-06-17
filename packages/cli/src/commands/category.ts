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
    const rows = await cache.categoryInsights({
      categoryKeyword: args.name,
      sites: parseCsvArg(args.sites),
    });
    printTable({ rows, options: { title: `Category: "${args.name}"` } });
  },
});
