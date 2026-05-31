import { toRecord, toRecordArray } from '@packrat/guards';
import { defineCommand } from 'citty';
import consola from 'consola';
import { getAdminClient } from '../../api/client';
import { requireAdmin, runApi } from '../../api/run';
import { printTable } from '../../shared';

const listCmd = defineCommand({
  meta: { name: 'list', description: 'Search/list users.' },
  args: {
    q: { type: 'string', description: 'Email/name filter' },
    limit: { type: 'string', default: '50' },
    offset: { type: 'string', default: '0' },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    await requireAdmin();
    const client = await getAdminClient();
    const data = await runApi({
      promise: client.admin['users-list'].get({
        query: {
          q: args.q,
          limit: Number.parseInt(args.limit, 10),
          offset: Number.parseInt(args.offset, 10),
        },
      }),
      action: 'admin list users',
      requiresAdmin: true,
    });
    if (args.json) {
      process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
      return;
    }
    // Endpoint returns { data: [...], total, limit, offset }
    const items = toRecordArray(toRecord(data).data);
    printTable({
      rows: items.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name ?? u.firstName,
        createdAt: u.createdAt,
      })),
      options: { title: 'Users' },
    });
  },
});

const hardDeleteCmd = defineCommand({
  meta: { name: 'hard-delete', description: 'GDPR-style hard delete (irreversible).' },
  args: {
    id: { type: 'positional', required: true, description: 'User ID' },
    reason: { type: 'string', required: true, description: 'Audit reason (required)' },
    yes: { type: 'boolean', alias: 'y', default: false },
  },
  async run({ args }) {
    await requireAdmin();
    if (!args.yes) {
      const confirm = await consola.prompt(`Hard-delete user ${args.id}? This is irreversible.`, {
        type: 'confirm',
      });
      if (!confirm) {
        consola.info('Aborted.');
        return;
      }
    }
    const client = await getAdminClient();
    await runApi({
      promise: client.admin.users({ id: args.id }).hard.delete({ reason: args.reason }),
      action: 'hard delete user',
      resourceHint: `user ${args.id}`,
      requiresAdmin: true,
    });
    consola.success(`Hard-deleted ${args.id}.`);
  },
});

export default defineCommand({
  meta: { name: 'users', description: 'Admin user operations.' },
  subCommands: {
    list: () => Promise.resolve(listCmd),
    'hard-delete': () => Promise.resolve(hardDeleteCmd),
  },
});
