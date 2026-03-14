import { defineCommand } from 'citty';
import consola from 'consola';
import { ensureCache, printTable } from '../shared';

export default defineCommand({
  meta: { name: 'schema', description: 'Analyze data schema and field coverage per site' },
  args: {
    site: { type: 'string', alias: 's', description: 'Filter to specific site' },
  },
  async run({ args }) {
    const cache = await ensureCache();
    const conn = cache.getConnection();

    const { SQLFragments } = await import('../../core/query-builder');
    const siteFilter = args.site ? `WHERE site = '${SQLFragments.escapeSql(args.site)}'` : '';

    // Field coverage per site
    const result = await conn.runAndReadAll(`
      SELECT
        site,
        COUNT(*) as total,
        ROUND(100.0 * SUM(CASE WHEN name IS NOT NULL AND name != '' AND name != 'Unknown' THEN 1 ELSE 0 END) / COUNT(*), 1) as name_pct,
        ROUND(100.0 * SUM(CASE WHEN brand IS NOT NULL AND brand != '' AND brand != 'Unknown' THEN 1 ELSE 0 END) / COUNT(*), 1) as brand_pct,
        ROUND(100.0 * SUM(CASE WHEN category IS NOT NULL AND category != '' AND category != 'Uncategorized' THEN 1 ELSE 0 END) / COUNT(*), 1) as category_pct,
        ROUND(100.0 * SUM(CASE WHEN price > 0 THEN 1 ELSE 0 END) / COUNT(*), 1) as price_pct,
        ROUND(100.0 * SUM(CASE WHEN product_url IS NOT NULL AND product_url != '' THEN 1 ELSE 0 END) / COUNT(*), 1) as url_pct,
        ROUND(100.0 * SUM(CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 1 ELSE 0 END) / COUNT(*), 1) as image_pct,
        ROUND(100.0 * SUM(CASE WHEN rating_value IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*), 1) as rating_pct,
        ROUND(100.0 * SUM(CASE WHEN review_count IS NOT NULL AND review_count > 0 THEN 1 ELSE 0 END) / COUNT(*), 1) as reviews_pct,
        ROUND(100.0 * SUM(CASE WHEN weight IS NOT NULL AND weight > 0 THEN 1 ELSE 0 END) / COUNT(*), 1) as weight_pct,
        ROUND(100.0 * SUM(CASE WHEN description IS NOT NULL AND LENGTH(description) > 10 THEN 1 ELSE 0 END) / COUNT(*), 1) as desc_pct
      FROM gear_data
      ${siteFilter}
      GROUP BY site
      ORDER BY total DESC
    `);

    const columns = result.columnNames();
    const rows = result.getRows().map((row) => {
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < columns.length; i++) {
        const val = row[i];
        // Add % suffix to percentage columns
        if (columns[i].endsWith('_pct')) {
          obj[columns[i].replace('_pct', '%')] = `${val}%`;
        } else {
          obj[columns[i]] = val;
        }
      }
      return obj;
    });

    if (rows.length === 0) {
      consola.warn('No data found.');
      return;
    }

    printTable(rows, { title: 'Field Coverage by Site (%)' });
  },
});
