import { Enrichment } from '@packrat/analytics';
import { defineCommand } from 'citty';
import consola from 'consola';
import { parsePositiveIntArg } from '../args';
import { ensureCache, printSummary, printTable } from '../shared';

export default defineCommand({
  meta: { name: 'images', description: 'Cross-retailer image aggregation' },
  args: {
    product: { type: 'positional', description: 'Product to search', required: false },
    build: { type: 'boolean', alias: 'b', description: 'Build image aggregation table' },
    limit: { type: 'string', alias: 'l', description: 'Result limit', default: '20' },
  },
  async run({ args }) {
    const cache = await ensureCache();
    const conn = cache.getConnection();
    const limit = parsePositiveIntArg(args.limit, '--limit');

    const enrichment = new Enrichment(conn);

    if (args.build) {
      consola.start('Building image aggregation...');
      const stats = await enrichment.buildImages();
      printSummary(
        {
          'Total images': stats.total_images,
          'Products with images': stats.products_with_images,
          'Unique URLs': stats.unique_urls,
        },
        'Image Aggregation Complete',
      );
      return;
    }

    if (!args.product) {
      consola.error('Provide a product name to search, or use --build to create the image table.');
      return;
    }

    const images = await enrichment.getProductImages(args.product, limit);
    if (images.length === 0) {
      consola.warn('No images found. Run `packrat images --build` first.');
      return;
    }

    printTable(
      images.map((img) => ({
        Site: img.site,
        Name: String(img.name).slice(0, 40),
        URL: String(img.url).slice(0, 60),
      })),
      { title: `Images: "${args.product}"` },
    );
  },
});
