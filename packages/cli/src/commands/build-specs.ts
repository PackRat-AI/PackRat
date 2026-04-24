import { SpecParser } from '@packrat/analytics';
import { defineCommand } from 'citty';
import consola from 'consola';
import { ensureCache } from '../shared';

export default defineCommand({
  meta: { name: 'build-specs', description: 'Extract structured specs from all products' },
  async run() {
    const cache = await ensureCache();
    const conn = cache.getConnection();

    consola.start('Building spec table...');
    const parser = new SpecParser(conn);
    const stats = await parser.build();
    consola.success(
      `Parsed ${stats.parsed.toLocaleString()} / ${stats.total.toLocaleString()} products`,
    );
  },
});
