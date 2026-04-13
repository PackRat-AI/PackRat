import { defineCommand } from 'citty';
import { SpecParser } from '@packrat/data-lake';
import { getCache, printTable } from '../shared';

export default defineCommand({
  meta: { name: 'specs', description: 'View parsed specs for a product' },
  args: {
    product: { type: 'positional', description: 'Product name to search', required: true },
    limit: { type: 'string', alias: 'l', description: 'Result limit', default: '10' },
  },
  async run({ args }) {
    const cache = await getCache();
    const conn = cache.getConnection();

    const parser = new SpecParser(conn);
    const rows = await parser.getProductSpecs(args.product, Number(args.limit));
    printTable(
      rows.map(
        ({
          name,
          brand,
          weight_grams,
          capacity_liters,
          temp_rating_f,
          fill_power,
          seasons,
          gender,
          fabric,
        }) => ({
          name: String(name).slice(0, 40),
          brand,
          'wt(g)': weight_grams,
          'cap(L)': capacity_liters,
          'temp(F)': temp_rating_f,
          fill: fill_power,
          seasons,
          gender,
          fabric,
        }),
      ),
      { title: `Specs: "${args.product}"` },
    );
  },
});
