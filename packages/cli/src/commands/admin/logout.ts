import { defineCommand } from 'citty';
import consola from 'consola';
import { saveConfig } from '../../api/config';

export default defineCommand({
  meta: { name: 'logout', description: 'Forget the stored admin JWT.' },
  async run() {
    await saveConfig({ adminToken: null, adminTokenExpiresAt: null });
    consola.success('Admin token cleared.');
  },
});
