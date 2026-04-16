import { EntityResolver } from '@packrat/analytics';
import { defineCommand } from 'citty';
import consola from 'consola';
import { ensureCache, printSummary, printTable } from '../shared';

export default defineCommand({
  meta: {
    name: 'resolve',
    description: 'Run entity resolution to deduplicate products across sites',
  },
  args: {
    product: {
      type: 'positional',
      description: 'Find cross-site listings for a product',
      required: false,
    },
    build: { type: 'boolean', alias: 'b', description: 'Build entity resolution table' },
    'min-confidence': {
      type: 'string',
      alias: 'c',
      description: 'Minimum match confidence (0-1)',
      default: '0.65',
    },
    limit: { type: 'string', alias: 'l', description: 'Result limit', default: '20' },
  },
  async run({ args }) {
    const cache = await ensureCache();
    const conn = cache.getConnection();

    const resolver = new EntityResolver(conn);

    if (args.build) {
      consola.start('Running entity resolution (this may take a while)...');
      const stats = await resolver.build(Number(args['min-confidence']));
      printSummary(
        {
          'Total listings': stats.total,
          'Unique products': stats.entities,
          'Dedup ratio': `${stats.dedupRatio}%`,
        },
        'Entity Resolution Complete',
      );
      return;
    }

    if (!args.product) {
      consola.error('Provide a product name, or use --build to run entity resolution.');
      return;
    }

    const matches = await resolver.identifyProduct(args.product, Number(args.limit));
    if (matches.length === 0) {
      consola.warn('No matches. Run `packrat resolve --build` first.');
      return;
    }

    printTable(
      matches.map((m) => ({
        'Canonical ID': String(m.canonical_id).slice(0, 8),
        Site: m.site,
        Name: String(m.name).slice(0, 35),
        Brand: m.brand,
        Price: m.price,
        Confidence: m.confidence,
        Method: m.match_method,
      })),
      { title: `Cross-site listings: "${args.product}"` },
    );
  },
});
