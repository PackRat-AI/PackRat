import { defineCommand } from 'citty';
import consola from 'consola';
import { getAdminClient } from '../../api/client';
import { requireAdmin, runApi } from '../../api/run';
import { printTable } from '../../shared';

const searchCmd = defineCommand({
  meta: { name: 'search', description: 'Admin trail search.' },
  args: {
    q: { type: 'positional', required: true },
    sport: { type: 'string' },
    limit: { type: 'string', default: '50' },
    offset: { type: 'string', default: '0' },
  },
  async run({ args }) {
    await requireAdmin();
    const client = await getAdminClient();
    const data = await runApi(
      client.admin.trails.search.get({
        query: {
          q: args.q,
          sport: args.sport,
          limit: Number.parseInt(args.limit, 10),
          offset: Number.parseInt(args.offset, 10),
        },
      }),
      { action: 'admin search trails', requiresAdmin: true },
    );
    const trails = Array.isArray((data as Record<string, unknown>).trails)
      ? ((data as Record<string, unknown>).trails as Record<string, unknown>[])
      : [];
    printTable(
      trails.map((t) => ({ osmId: t.osmId, name: t.name, sport: t.sport })),
      { title: 'Trails (admin)' },
    );
  },
});

const reportsCmd = defineCommand({
  meta: { name: 'reports', description: 'List trail condition reports (admin).' },
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
      client.admin.trails.conditions.get({
        query: {
          q: args.q,
          limit: Number.parseInt(args.limit, 10),
          offset: Number.parseInt(args.offset, 10),
          includeDeleted: args['include-deleted'] ? 1 : 0,
        },
      }),
      { action: 'admin list trail reports', requiresAdmin: true },
    );
    if (args.json) {
      process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
      return;
    }
    const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
    printTable(
      rows.map((r) => ({
        id: r.id,
        trailName: r.trailName,
        condition: r.overallCondition,
        userId: r.userId,
        deleted: r.deleted,
      })),
      { title: 'Trail reports (admin)' },
    );
  },
});

const deleteReportCmd = defineCommand({
  meta: { name: 'delete-report', description: 'Soft-delete a trail condition report (admin).' },
  args: { id: { type: 'positional', required: true } },
  async run({ args }) {
    await requireAdmin();
    const client = await getAdminClient();
    await runApi(client.admin.trails.conditions({ reportId: args.id }).delete(), {
      action: 'admin delete trail report',
      resourceHint: `report ${args.id}`,
      requiresAdmin: true,
    });
    consola.success(`Deleted ${args.id}.`);
  },
});

export default defineCommand({
  meta: { name: 'trails', description: 'Admin trail / trail-condition ops.' },
  subCommands: {
    search: () => Promise.resolve(searchCmd),
    reports: () => Promise.resolve(reportsCmd),
    'delete-report': () => Promise.resolve(deleteReportCmd),
  },
});
