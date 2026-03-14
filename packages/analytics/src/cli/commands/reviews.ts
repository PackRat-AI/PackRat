import { defineCommand } from 'citty';
import consola from 'consola';
import { ensureCache, printSummary, printTable } from '../shared';

export default defineCommand({
  meta: { name: 'reviews', description: 'Cross-retailer review aggregation' },
  args: {
    product: { type: 'positional', description: 'Product to search', required: false },
    build: { type: 'boolean', alias: 'b', description: 'Build review aggregation table' },
    limit: { type: 'string', alias: 'l', description: 'Result limit', default: '20' },
  },
  async run({ args }) {
    const cache = await ensureCache();
    const conn = cache.getConnection();

    const { Enrichment } = await import('../../core/enrichment');
    const enrichment = new Enrichment(conn);

    if (args.build) {
      consola.start('Building review aggregation...');
      const stats = await enrichment.buildReviews();
      printSummary(
        {
          'Total review entries': stats.total_reviews,
          'Products with reviews': stats.products_with_reviews,
          'Sites with reviews': stats.sites_with_reviews,
          'Average rating': stats.avg_rating,
        },
        'Review Aggregation Complete',
      );
      return;
    }

    if (!args.product) {
      consola.error('Provide a product name to search, or use --build to create the review table.');
      return;
    }

    const reviews = await enrichment.getProductReviews(args.product, Number(args.limit));
    if (reviews.length === 0) {
      consola.warn('No reviews found. Run `packrat reviews --build` first.');
      return;
    }

    printTable(
      reviews.map((r) => ({
        Site: r.site,
        Name: String(r.name).slice(0, 40),
        Brand: r.brand,
        Rating: r.rating,
        Reviews: r.review_count,
        Price: r.price,
        'Wtd Avg': r.weighted_avg_rating,
        'Total Reviews': r.total_reviews,
      })),
      { title: `Reviews: "${args.product}"` },
    );
  },
});
