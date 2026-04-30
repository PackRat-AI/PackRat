import { defineCommand } from 'citty';
import { ensureCache, printSummary } from '../shared';

export default defineCommand({
  meta: { name: 'summary', description: 'Quick market overview' },
  async run() {
    const cache = await ensureCache();
    const data = await cache.getMarketSummary();
    printSummary(
      {
        'Total Items': data.totalItems.toLocaleString(),
        Sites: data.totalSites,
        Brands: data.totalBrands.toLocaleString(),
        Categories: data.totalCategories.toLocaleString(),
        'Avg Price': `$${data.avgPrice.toFixed(2)}`,
        'In Stock': `${data.inStockPct}%`,
      },
      'Market Summary',
    );
  },
});
