import { defineCommand } from 'citty';
import { getUserClient } from '../../api/client';
import { asRecordArray } from '../../api/format';
import { nowIso, shortId } from '../../api/ids';
import { requireAuth, runApi } from '../../api/run';
import { printTable } from '../../shared';

const listCmd = defineCommand({
  meta: { name: 'list', description: 'List pack templates (user + app curated).' },
  args: { json: { type: 'boolean', default: false } },
  async run({ args }) {
    await requireAuth();
    const client = await getUserClient();
    const data = await runApi(client['pack-templates'].get(), { action: 'list pack templates' });
    if (args.json) {
      process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
      return;
    }
    printTable(
      asRecordArray(data).map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        isApp: r.isAppTemplate,
      })),
      { title: 'Pack templates' },
    );
  },
});

const getCmd = defineCommand({
  meta: { name: 'get', description: 'Get a pack template with its items.' },
  args: { id: { type: 'positional', required: true, description: 'Template ID' } },
  async run({ args }) {
    await requireAuth();
    const client = await getUserClient();
    const data = await runApi(client['pack-templates']({ templateId: args.id }).get(), {
      action: 'get pack template',
      resourceHint: `template ${args.id}`,
    });
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
  },
});

const createCmd = defineCommand({
  meta: { name: 'create', description: 'Create a pack template.' },
  args: {
    name: { type: 'positional', required: true },
    category: { type: 'string', default: 'general' },
    description: { type: 'string', alias: 'd' },
    'app-template': {
      type: 'boolean',
      default: false,
      description: 'Mark as app template (admin)',
    },
  },
  async run({ args }) {
    await requireAuth();
    const client = await getUserClient();
    const id = shortId('pt');
    const now = nowIso();
    const data = await runApi(
      client['pack-templates'].post({
        id,
        name: args.name,
        description: args.description,
        category: args.category,
        isAppTemplate: args['app-template'],
        localCreatedAt: now,
        localUpdatedAt: now,
      }),
      { action: 'create pack template' },
    );
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
  },
});

const deleteCmd = defineCommand({
  meta: { name: 'delete', description: 'Delete a pack template.' },
  args: { id: { type: 'positional', required: true } },
  async run({ args }) {
    await requireAuth();
    const client = await getUserClient();
    await runApi(client['pack-templates']({ templateId: args.id }).delete(), {
      action: 'delete pack template',
      resourceHint: `template ${args.id}`,
    });
    process.stdout.write(`Deleted ${args.id}\n`);
  },
});

export default defineCommand({
  meta: { name: 'templates', description: 'Pack templates.' },
  subCommands: {
    list: () => Promise.resolve(listCmd),
    get: () => Promise.resolve(getCmd),
    create: () => Promise.resolve(createCmd),
    delete: () => Promise.resolve(deleteCmd),
  },
});
