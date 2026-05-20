import { defineCommand } from 'citty';
import consola from 'consola';
import { getUserClient } from '../../api/client';
import { requireAuth, runApi } from '../../api/run';

export default defineCommand({
  meta: {
    name: 'gap-analysis',
    description: 'Run gear gap analysis for a pack against a planned trip.',
  },
  args: {
    id: { type: 'positional', description: 'Pack ID', required: true },
    destination: { type: 'string', required: true, description: 'Trip destination' },
    'trip-type': {
      type: 'string',
      default: 'backpacking',
      description: 'Trip / activity type (backpacking, camping, hiking, ...)',
    },
    duration: {
      type: 'string',
      default: '3',
      description: 'Trip duration in days',
    },
    start: { type: 'string', description: 'ISO start date' },
    end: { type: 'string', description: 'ISO end date' },
  },
  async run({ args }) {
    await requireAuth();
    const duration = Number.parseInt(args.duration, 10);
    if (!Number.isInteger(duration) || duration < 1) {
      consola.error(`Invalid --duration "${args.duration}" — must be a positive integer (days).`);
      process.exit(1);
    }
    const client = await getUserClient();
    const result = await runApi({
      promise: client.packs({ packId: args.id })['gap-analysis'].post({
        destination: args.destination,
        tripType: args['trip-type'],
        duration,
        startDate: args.start,
        endDate: args.end,
      }),
      action: 'analyze pack gaps',
      resourceHint: `pack ${args.id}`,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  },
});
