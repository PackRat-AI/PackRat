import { defineCommand } from 'citty';
import consola from 'consola';
import { ensureCache } from '../shared';

export default defineCommand({
  meta: { name: 'export', description: 'Export dataset to file' },
  args: {
    format: { type: 'string', alias: 'f', description: 'Format: csv|parquet|json', default: 'csv' },
    'output-dir': {
      type: 'string',
      alias: 'o',
      description: 'Output directory',
      default: 'data/exports',
    },
    sample: { type: 'string', description: 'Limit records (for sampling)' },
  },
  async run({ args }) {
    const cache = await ensureCache();
    const conn = cache.getConnection();

    const { mkdirSync } = await import('node:fs');
    mkdirSync(args['output-dir'], { recursive: true });

    const limit = args.sample ? `LIMIT ${Number(args.sample)}` : '';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `packrat_export_${timestamp}.${args.format}`;
    const filepath = `${args['output-dir']}/${filename}`;

    const formatMap: Record<string, string> = {
      csv: `COPY (SELECT * FROM gear_data ${limit}) TO '${filepath}' (HEADER, DELIMITER ',')`,
      parquet: `COPY (SELECT * FROM gear_data ${limit}) TO '${filepath}' (FORMAT PARQUET)`,
      json: `COPY (SELECT * FROM gear_data ${limit}) TO '${filepath}' (FORMAT JSON, ARRAY true)`,
    };

    const sql = formatMap[args.format];
    if (!sql) {
      consola.error(`Unknown format: ${args.format}. Use csv, parquet, or json.`);
      return;
    }

    consola.start(`Exporting to ${filepath}...`);
    await conn.run(sql);
    consola.success(`Exported to ${filepath}`);
  },
});
