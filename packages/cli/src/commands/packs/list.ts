import { toRecordArray } from '@packrat/guards';
import { safeJsonStringify } from '@packrat/utils';
import { defineCommand } from 'citty';
import { getUserClient } from '../../api/client';
import { requireAuth, runApi } from '../../api/run';
import { printTable } from '../../shared';

export default defineCommand({
  meta: { name: 'list', description: 'List your packs.' },
  args: {
    'include-public': {
      type: 'boolean',
      description: 'Include public packs from other users',
      default: false,
    },
    json: { type: 'boolean', description: 'Print raw JSON', default: false },
  },
  async run({ args }) {
    await requireAuth();
    const client = await getUserClient();
    const includePublic = args['include-public'] ? 1 : 0;
    const packs = await runApi({
      promise: client.packs.get({ query: { includePublic } }),
      action: 'list packs',
    });
    if (args.json) {
      process.stdout.write(`${safeJsonStringify(packs, null, 2)}\n`);
      return;
    }
    printTable({
      rows: toRecordArray(packs).map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        items: r.itemCount,
        totalGrams: r.totalWeight,
        isPublic: r.isPublic,
      })),
      options: { title: 'Your packs' },
    });
  },
});
