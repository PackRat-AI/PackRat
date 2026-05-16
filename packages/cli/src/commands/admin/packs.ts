import { defineCommand } from 'citty';
import consola from 'consola';
import { getAdminClient } from '../../api/client';
import { asRecordArray } from '../../api/format';
import { requireAdmin, runApi } from '../../api/run';
import { printTable } from '../../shared';

const listCmd = defineCommand({
  meta: { name: 'list', description: 'Search/list packs across all users.' },
  args: {
    q: { type: 'string' },
    limit: { type: 'string', default: '50' },
    offset: { type: 'string', default: '0' },
    'include-deleted': { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    await requireAdmin();
    const client = await getAdminClient();
    const data = await runApi(
      client.admin['packs-list'].get({
        query: {
          q: args.q,
          limit: Number.parseInt(args.limit, 10),
          offset: Number.parseInt(args.offset, 10),
          includeDeleted: args['include-deleted'] ? '1' : '0',
        },
      }),
      { action: 'admin list packs', requiresAdmin: true },
    );
    if (args.json) {
      process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
      return;
    }
    printTable(
      asRecordArray(data).map((p) => ({
        id: p.id,
        name: p.name,
        userId: p.userId,
        deleted: p.deleted,
      })),
      { title: 'Packs (admin)' },
    );
  },
});

const deleteCmd = defineCommand({
  meta: { name: 'delete', description: 'Soft-delete any pack (admin).' },
  args: {
    id: { type: 'positional', required: true, description: 'Pack ID' },
    yes: { type: 'boolean', alias: 'y', default: false },
  },
  async run({ args }) {
    await requireAdmin();
    if (!args.yes) {
      const confirm = await consola.prompt(`Delete pack ${args.id}?`, { type: 'confirm' });
      if (!confirm) return consola.info('Aborted.');
    }
    const client = await getAdminClient();
    await runApi(client.admin.packs({ id: args.id }).delete(), {
      action: 'admin delete pack',
      resourceHint: `pack ${args.id}`,
      requiresAdmin: true,
    });
    consola.success(`Deleted ${args.id}.`);
  },
});

export default defineCommand({
  meta: { name: 'packs', description: 'Admin pack ops.' },
  subCommands: {
    list: () => Promise.resolve(listCmd),
    delete: () => Promise.resolve(deleteCmd),
  },
});
