import { defineCommand } from 'citty';
import { getAdminClient } from '../../api/client';
import { requireAdmin, runApi } from '../../api/run';
import { printSummary } from '../../shared';

export default defineCommand({
  meta: { name: 'stats', description: 'High-level platform stats.' },
  async run() {
    await requireAdmin();
    const client = await getAdminClient();
    const data = await runApi(client.admin.stats.get(), {
      action: 'admin stats',
      requiresAdmin: true,
    });
    printSummary(data as Record<string, unknown>, 'Admin stats');
  },
});
