import { isString, toRecord, toRecordArray } from '@packrat/guards';
import { defineCommand } from 'citty';
import { getUserClient } from '../../api/client';
import { requireAuth, runApi } from '../../api/run';
import { printSummary, printTable } from '../../shared';

const searchCmd = defineCommand({
  meta: { name: 'search', description: 'Text search the gear catalog.' },
  args: {
    q: { type: 'positional', required: true, description: 'Search keyword' },
    category: { type: 'string', alias: 'c' },
    limit: { type: 'string', alias: 'l', default: '10' },
    page: { type: 'string', default: '1' },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    await requireAuth();
    const client = await getUserClient();
    const limit = Number.parseInt(args.limit, 10);
    const page = Number.parseInt(args.page, 10);
    const data = await runApi(
      client.catalog.get({
        query: { q: args.q, category: args.category, limit, page },
      }),
      { action: 'search catalog' },
    );
    if (args.json) {
      process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
      return;
    }
    printTable(
      toRecordArray(toRecord(data).items).map((it) => ({
        id: it.id,
        name: isString(it.name) ? it.name.slice(0, 60) : it.name,
        brand: it.brand,
        weight: it.weight,
        price: it.price,
        rating: it.ratingValue,
      })),
      { title: `Catalog "${args.q}"` },
    );
  },
});

const semanticCmd = defineCommand({
  meta: { name: 'semantic', description: 'Semantic / vector search.' },
  args: {
    q: { type: 'positional', required: true, description: 'Natural-language query' },
    limit: { type: 'string', alias: 'l', default: '8' },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    await requireAuth();
    const client = await getUserClient();
    const limit = Number.parseInt(args.limit, 10);
    const data = await runApi(
      client.catalog['vector-search'].get({ query: { q: args.q, limit, offset: 0 } }),
      { action: 'semantic catalog search' },
    );
    if (args.json) {
      process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
      return;
    }
    printTable(
      toRecordArray(toRecord(data).items).map((it) => ({
        id: it.id,
        name: isString(it.name) ? it.name.slice(0, 60) : it.name,
        brand: it.brand,
        score: it.score,
      })),
      { title: `Semantic: "${args.q}"` },
    );
  },
});

const getCmd = defineCommand({
  meta: { name: 'get', description: 'Get a catalog item by ID.' },
  args: {
    id: { type: 'positional', required: true, description: 'Catalog item ID (numeric)' },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    await requireAuth();
    const client = await getUserClient();
    const item = await runApi(client.catalog({ id: args.id }).get(), {
      action: 'get catalog item',
      resourceHint: `item ${args.id}`,
    });
    if (args.json) {
      process.stdout.write(`${JSON.stringify(item, null, 2)}\n`);
      return;
    }
    const r = toRecord(item);
    printSummary(
      {
        id: r.id,
        name: r.name,
        brand: r.brand,
        weight: r.weight,
        price: r.price,
        rating: r.ratingValue,
        reviewCount: r.ratingCount,
        productUrl: r.productUrl,
      },
      `Item ${r.id}`,
    );
  },
});

const categoriesCmd = defineCommand({
  meta: { name: 'categories', description: 'List catalog categories.' },
  async run() {
    await requireAuth();
    const client = await getUserClient();
    const data = await runApi(client.catalog.categories.get({ query: { limit: 50 } }), {
      action: 'list catalog categories',
    });
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
  },
});

export default defineCommand({
  meta: { name: 'catalog', description: 'Search and inspect the PackRat gear catalog.' },
  subCommands: {
    search: () => Promise.resolve(searchCmd),
    semantic: () => Promise.resolve(semanticCmd),
    get: () => Promise.resolve(getCmd),
    categories: () => Promise.resolve(categoriesCmd),
  },
});
