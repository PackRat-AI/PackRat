import { toRecord } from '@packrat/guards';
import { defineCommand } from 'citty';
import { getUserClient } from '../../api/client';
import { requireAuth, runApi } from '../../api/run';
import { printSummary } from '../../shared';

export default defineCommand({
  meta: { name: 'get', description: 'Get a single pack with items and weight totals.' },
  args: {
    id: { type: 'positional', description: 'Pack ID', required: true },
    json: { type: 'boolean', description: 'Print raw JSON', default: false },
  },
  async run({ args }) {
    await requireAuth();
    const client = await getUserClient();
    const pack = await runApi(client.packs({ packId: args.id }).get(), {
      action: 'get pack',
      resourceHint: `pack ${args.id}`,
    });
    if (args.json) {
      process.stdout.write(`${JSON.stringify(pack, null, 2)}\n`);
      return;
    }
    const p = toRecord(pack);
    printSummary(
      {
        id: p.id,
        name: p.name,
        category: p.category,
        description: p.description,
        totalGrams: p.totalWeight,
        baseGrams: p.baseWeight,
        wornGrams: p.wornWeight,
        consumableGrams: p.consumableWeight,
        isPublic: p.isPublic,
        items: Array.isArray(p.items) ? p.items.length : 0,
      },
      `Pack ${p.name ?? args.id}`,
    );
  },
});
