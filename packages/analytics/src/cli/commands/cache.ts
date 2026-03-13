import { defineCommand } from 'citty';
import consola from 'consola';
import { ensureCache, getCache, printSummary } from '../shared';

export default defineCommand({
  meta: { name: 'cache', description: 'Manage local data cache' },
  args: {
    refresh: { type: 'boolean', alias: 'r', description: 'Force refresh from R2' },
  },
  async run({ args }) {
    if (args.refresh) {
      await ensureCache(true);
    } else {
      const cache = await getCache();
      const stats = cache.getCacheStats();
      if (stats.recordCount === 0) {
        consola.info('Cache is empty. Run with --refresh to populate.');
      } else {
        printSummary(
          {
            Records: stats.recordCount.toLocaleString(),
            Sites: stats.sites.join(', '),
            'Last Updated': stats.updatedAt ?? 'Never',
          },
          'Cache Status',
        );
      }
    }
  },
});
