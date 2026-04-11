import { defineCommand } from 'citty';
import { ensureCache, printTable } from '../shared';

export default defineCommand({
  meta: { name: 'stats', description: 'Per-site data dashboard' },
  async run() {
    const cache = await ensureCache();
    const rows = await cache.getSiteStats();
    printTable(rows as unknown as Record<string, unknown>[], { title: 'Site Statistics' });
  },
});
