import { safeJsonStringify } from '@packrat/utils';
import { defineCommand } from 'citty';
import consola from 'consola';
import { getAdminClient } from '../../api/client';
import { requireAdmin, runApi } from '../../api/run';

const listCmd = defineCommand({
  meta: { name: 'list', description: 'List recent ETL jobs.' },
  args: { limit: { type: 'string', default: '20' } },
  async run({ args }) {
    await requireAdmin();
    const client = await getAdminClient();
    const data = await runApi({
      promise: client.admin.analytics.catalog.etl.get({
        query: { limit: Number.parseInt(args.limit, 10) },
      }),
      action: 'admin list ETL jobs',
      requiresAdmin: true,
    });
    process.stdout.write(`${safeJsonStringify(data, null, 2)}\n`);
  },
});

const failureSummaryCmd = defineCommand({
  meta: { name: 'failure-summary', description: 'Top recent failure patterns.' },
  args: { limit: { type: 'string', default: '10' } },
  async run({ args }) {
    await requireAdmin();
    const client = await getAdminClient();
    const data = await runApi({
      promise: client.admin.analytics.catalog.etl['failure-summary'].get({
        query: { limit: Number.parseInt(args.limit, 10) },
      }),
      action: 'admin ETL failure summary',
      requiresAdmin: true,
    });
    process.stdout.write(`${safeJsonStringify(data, null, 2)}\n`);
  },
});

const jobFailuresCmd = defineCommand({
  meta: { name: 'job-failures', description: 'Per-job failure drill-down.' },
  args: {
    id: { type: 'positional', required: true, description: 'ETL job ID' },
    limit: { type: 'string', default: '50' },
  },
  async run({ args }) {
    await requireAdmin();
    const client = await getAdminClient();
    const data = await runApi({
      promise: client.admin.analytics.catalog.etl({ jobId: args.id }).failures.get({
        query: { limit: Number.parseInt(args.limit, 10) },
      }),
      action: 'admin ETL job failures',
      resourceHint: `job ${args.id}`,
      requiresAdmin: true,
    });
    process.stdout.write(`${safeJsonStringify(data, null, 2)}\n`);
  },
});

const resetStuckCmd = defineCommand({
  meta: { name: 'reset-stuck', description: 'Mark stuck-running jobs as failed.' },
  async run() {
    await requireAdmin();
    const client = await getAdminClient();
    const data = await runApi({
      promise: client.admin.analytics.catalog.etl['reset-stuck'].post({}),
      action: 'admin reset stuck ETL',
      requiresAdmin: true,
    });
    consola.success(`Done: ${safeJsonStringify(data)}`);
  },
});

const retryCmd = defineCommand({
  meta: { name: 'retry', description: 'Retry a failed ETL job.' },
  args: { id: { type: 'positional', required: true, description: 'ETL job ID' } },
  async run({ args }) {
    await requireAdmin();
    const client = await getAdminClient();
    const data = await runApi({
      promise: client.admin.analytics.catalog.etl({ jobId: args.id }).retry.post({}),
      action: 'admin retry ETL job',
      resourceHint: `job ${args.id}`,
      requiresAdmin: true,
    });
    consola.success(`Retried: ${safeJsonStringify(data)}`);
  },
});

export default defineCommand({
  meta: { name: 'etl', description: 'Admin ETL operations.' },
  subCommands: {
    list: () => Promise.resolve(listCmd),
    'failure-summary': () => Promise.resolve(failureSummaryCmd),
    'job-failures': () => Promise.resolve(jobFailuresCmd),
    'reset-stuck': () => Promise.resolve(resetStuckCmd),
    retry: () => Promise.resolve(retryCmd),
  },
});
