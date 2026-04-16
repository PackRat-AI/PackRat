import { SpecParser } from '@packrat/analytics';
import { defineCommand } from 'citty';
import { getCache, printTable } from '../shared';

export default defineCommand({
  meta: { name: 'filter', description: 'Multi-attribute product filter' },
  args: {
    category: { type: 'string', alias: 'c', description: 'Category filter' },
    'max-weight': { type: 'string', alias: 'w', description: 'Max weight (grams)' },
    'max-temp': { type: 'string', alias: 't', description: 'Max temp rating (F)' },
    'max-price': { type: 'string', alias: 'p', description: 'Max price' },
    'min-price': { type: 'string', description: 'Min price' },
    gender: { type: 'string', alias: 'g', description: 'Gender: men|women|unisex|youth' },
    seasons: { type: 'string', description: 'Season: 3-season|4-season' },
    sort: { type: 'string', description: 'Sort by: weight|price|temp', default: 'price' },
    limit: { type: 'string', alias: 'l', description: 'Result limit', default: '20' },
  },
  async run({ args }) {
    const cache = await getCache();
    const conn = cache.getConnection();

    const sortMap: Record<string, 'weight_grams' | 'price' | 'temp_rating_f'> = {
      weight: 'weight_grams',
      price: 'price',
      temp: 'temp_rating_f',
    };

    const parser = new SpecParser(conn);
    const rows = await parser.filterProducts({
      category: args.category,
      maxWeightG: args['max-weight'] ? Number(args['max-weight']) : undefined,
      maxTempF: args['max-temp'] ? Number(args['max-temp']) : undefined,
      maxPrice: args['max-price'] ? Number(args['max-price']) : undefined,
      minPrice: args['min-price'] ? Number(args['min-price']) : undefined,
      gender: args.gender,
      seasons: args.seasons,
      sortBy: sortMap[args.sort] ?? 'price',
      limit: Number(args.limit),
    });
    printTable(
      rows.map(({ name, brand, price, weight_grams, temp_rating_f, seasons, gender }) => ({
        name: String(name).slice(0, 40),
        brand,
        price,
        'wt(g)': weight_grams,
        'temp(F)': temp_rating_f,
        seasons,
        gender,
      })),
      { title: 'Filtered Products' },
    );
  },
});
