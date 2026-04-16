import { DataExporter } from '@packrat/analytics';
import { defineCommand } from 'citty';
import consola from 'consola';
import { ensureCache, printSummary } from '../shared';

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
    dedup: {
      type: 'string',
      alias: 'd',
      description: 'Dedup strategy: none|best_quality|merge_data',
      default: 'none',
    },
    quality: { type: 'boolean', alias: 'q', description: 'Include quality scores' },
    schema: { type: 'boolean', description: 'Generate DB schema SQL' },
    sku: { type: 'string', description: 'Filter by SKU pattern' },
  },
  async run({ args }) {
    const cache = await ensureCache();
    const conn = cache.getConnection();

    const exporter = new DataExporter(conn);

    if (args.schema) {
      const schemaPath = exporter.generateSchema(args['output-dir']);
      consola.success(`Database schema saved to ${schemaPath}`);
      return;
    }

    const format = args.format as 'csv' | 'parquet' | 'json';
    const dedup = (args.dedup ?? 'none') as 'none' | 'best_quality' | 'merge_data';

    consola.start(`Exporting (${dedup} dedup, ${format} format)...`);

    const summary = await exporter.export({
      format,
      outputDir: args['output-dir'],
      sample: args.sample ? Number(args.sample) : undefined,
      dedup,
      includeQuality: args.quality ?? dedup !== 'none',
      skuFilter: args.sku,
    });

    printSummary(
      {
        File: summary.filepath,
        Records: summary.totalRecords,
        'Unique SKUs': summary.uniqueSkus,
        Sites: summary.sites,
        Brands: summary.brands,
        Strategy: summary.strategy,
      },
      'Export Complete',
    );
  },
});
