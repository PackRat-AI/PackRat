import { defineCommand } from 'citty';
import consola from 'consola';
import { getAdminClient } from '../../api/client';
import { requireAdmin, runApi } from '../../api/run';
import { printTable } from '../../shared';

const listCmd = defineCommand({
  meta: { name: 'list', description: 'Search/list catalog items (admin view).' },
  args: {
    q: { type: 'string' },
    limit: { type: 'string', default: '50' },
    offset: { type: 'string', default: '0' },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    await requireAdmin();
    const client = await getAdminClient();
    const data = await runApi(
      client.admin['catalog-list'].get({
        query: {
          q: args.q,
          limit: Number.parseInt(args.limit, 10),
          offset: Number.parseInt(args.offset, 10),
        },
      }),
      { action: 'admin list catalog', requiresAdmin: true },
    );
    if (args.json) {
      process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
      return;
    }
    const items = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
    printTable(
      items.map((it) => ({
        id: it.id,
        name: typeof it.name === 'string' ? it.name.slice(0, 60) : it.name,
        brand: it.brand,
        weight: it.weight,
        price: it.price,
      })),
      { title: 'Catalog (admin)' },
    );
  },
});

const updateCmd = defineCommand({
  meta: { name: 'update', description: 'Update a catalog item (admin).' },
  args: {
    id: { type: 'positional', required: true, description: 'Catalog item ID' },
    name: { type: 'string' },
    brand: { type: 'string' },
    description: { type: 'string' },
    weight: { type: 'string', description: 'Weight (numeric)' },
    'weight-unit': { type: 'string', description: 'g | oz | kg | lb' },
    price: { type: 'string', description: 'Price (numeric)' },
  },
  async run({ args }) {
    await requireAdmin();
    const client = await getAdminClient();
    const body: Record<string, unknown> = {};
    if (args.name) body.name = args.name;
    if (args.brand) body.brand = args.brand;
    if (args.description) body.description = args.description;
    if (args.weight) body.weight = Number.parseFloat(args.weight);
    if (args['weight-unit']) body.weightUnit = args['weight-unit'];
    if (args.price) body.price = Number.parseFloat(args.price);
    await runApi(client.admin.catalog({ id: args.id }).patch(body), {
      action: 'admin update catalog item',
      resourceHint: `item ${args.id}`,
      requiresAdmin: true,
    });
    consola.success(`Updated ${args.id}.`);
  },
});

const deleteCmd = defineCommand({
  meta: { name: 'delete', description: 'Delete a catalog item (admin).' },
  args: {
    id: { type: 'positional', required: true },
    yes: { type: 'boolean', alias: 'y', default: false },
  },
  async run({ args }) {
    await requireAdmin();
    if (!args.yes) {
      const confirm = await consola.prompt(`Delete catalog item ${args.id}?`, { type: 'confirm' });
      if (!confirm) return consola.info('Aborted.');
    }
    const client = await getAdminClient();
    await runApi(client.admin.catalog({ id: args.id }).delete(), {
      action: 'admin delete catalog item',
      resourceHint: `item ${args.id}`,
      requiresAdmin: true,
    });
    consola.success(`Deleted ${args.id}.`);
  },
});

export default defineCommand({
  meta: { name: 'catalog', description: 'Admin catalog ops.' },
  subCommands: {
    list: () => Promise.resolve(listCmd),
    update: () => Promise.resolve(updateCmd),
    delete: () => Promise.resolve(deleteCmd),
  },
});
