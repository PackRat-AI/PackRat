import { defineCommand } from 'citty';
import consola from 'consola';
import { getUserClient } from '../../api/client';
import { requireAuth, runApi } from '../../api/run';

export default defineCommand({
  meta: { name: 'delete', description: 'Soft-delete a pack.' },
  args: {
    id: { type: 'positional', description: 'Pack ID', required: true },
    yes: { type: 'boolean', alias: 'y', description: 'Skip confirmation', default: false },
  },
  async run({ args }) {
    await requireAuth();
    if (!args.yes) {
      const confirm = await consola.prompt(`Delete pack ${args.id}?`, { type: 'confirm' });
      if (!confirm) {
        consola.info('Aborted.');
        return;
      }
    }
    const client = await getUserClient();
    await runApi(client.packs({ packId: args.id }).delete(), {
      action: 'delete pack',
      resourceHint: `pack ${args.id}`,
    });
    consola.success(`Deleted ${args.id}.`);
  },
});
