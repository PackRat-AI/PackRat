import { defineCommand } from 'citty';
import { ensureCache, printTable } from '../shared';

export default defineCommand({
  meta: { name: 'brand', description: 'Analyze products from a specific brand' },
  args: {
    name: { type: 'positional', description: 'Brand name', required: true },
    sites: { type: 'string', alias: 's', description: 'Comma-separated sites' },
  },
  async run({ args }) {
    const cache = await ensureCache();
    const rows = await cache.analyzeBrand(args.name, args.sites?.split(','));
    printTable(rows as unknown as Record<string, unknown>[], {
      title: `Brand Analysis: "${args.name}"`,
    });
  },
});
