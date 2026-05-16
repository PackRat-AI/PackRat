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
    const items = await runApi(client.packs({ packId: args.id }).items.get(), {
      action: 'list pack items',
      resourceHint: `pack ${args.id}`,
    });
    if (args.json) {
      process.stdout.write(`${JSON.stringify(items, null, 2)}\n`);
      return;
    }
    const rows = Array.isArray(items) ? items : [];
    printTable(
      rows.map((it) => {
        const r = it as Record<string, unknown>;
        return {
          id: r.id,
          name: r.name,
          category: r.category,
          weight: r.weight,
          qty: r.quantity,
          worn: r.worn,
          consumable: r.consumable,
        };
      }),
      { title: `Items in ${args.id}` },
    );
  },
});
