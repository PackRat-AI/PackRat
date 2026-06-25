import { toRecord } from '@packrat/guards';
import { PackCategorySchema } from '@packrat/schemas/constants';
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
      default: 'custom',
    },
    description: { type: 'string', alias: 'd', description: 'Optional description' },
    public: { type: 'boolean', description: 'Make pack public', default: false },
    tags: { type: 'string', description: 'Comma-separated tags' },
  },
  async run({ args }) {
    await requireAuth();
    const client = await getUserClient();
    const now = nowIso();
    const category = PackCategorySchema.parse(args.category);
    const tags = args.tags
      ? args.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined;
    const pack = await runApi({
      promise: client.packs.post({
        id: shortId('p'),
        name: args.name,
        description: args.description,
        category,
        isPublic: args.public,
        tags,
        localCreatedAt: now,
        localUpdatedAt: now,
      }),
      action: 'create pack',
    });
    consola.success(`Created pack ${toRecord(pack).id ?? '(unknown id)'}`);
  },
});
