import { defineCommand } from 'citty';
import consola from 'consola';
import { getUserClient } from '../../api/client';
import { nowIso, shortId } from '../../api/ids';
import { requireAuth, runApi } from '../../api/run';

export default defineCommand({
  meta: { name: 'create', description: 'Create a new pack.' },
  args: {
    name: { type: 'positional', description: 'Pack name', required: true },
    category: {
      type: 'string',
      alias: 'c',
      description: 'Pack category (backpacking, camping, hiking, ...)',
      default: 'general',
    },
    description: { type: 'string', alias: 'd', description: 'Optional description' },
    public: { type: 'boolean', description: 'Make pack public', default: false },
    tags: { type: 'string', description: 'Comma-separated tags' },
  },
  async run({ args }) {
    await requireAuth();
    const client = await getUserClient();
    const id = shortId('p');
    const now = nowIso();
    const tags = args.tags
      ? args.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined;
    const pack = await runApi(
      client.packs.post({
        id,
        name: args.name,
        description: args.description,
        category: args.category,
        isPublic: args.public,
        tags,
        localCreatedAt: now,
        localUpdatedAt: now,
      }),
      { action: 'create pack' },
    );
    consola.success(`Created pack ${(pack as Record<string, unknown>).id ?? id}`);
  },
});
