import { toRecordArray } from '@packrat/guards';
import { defineCommand } from 'citty';
import { getUserClient } from '../../api/client';
import { requireAuth, runApi } from '../../api/run';
import { printTable } from '../../shared';

export default defineCommand({
  meta: { name: 'items', description: 'List items in a pack.' },
  args: {
    id: { type: 'positional', description: 'Pack ID', required: true },
    json: { type: 'boolean', description: 'Print raw JSON', default: false },
  },
  async run({ args }) {
    await requireAuth();
    const client = await getUserClient();
    const items = await runApi({
      promise: client.packs({ packId: args.id }).items.get(),
      action: 'list pack items',
      resourceHint: `pack ${args.id}`,
    });
    if (args.json) {
      process.stdout.write(`${JSON.stringify(items, null, 2)}\n`);
      return;
    }
    printTable({
      rows: toRecordArray(items).map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        weight: r.weight,
        qty: r.quantity,
        worn: r.worn,
        consumable: r.consumable,
      })),
      options: { title: `Items in ${args.id}` },
    });
  },
});
