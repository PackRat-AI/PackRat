import { defineCommand } from 'citty';
import { getUserClient } from '../../api/client';
import { requireAuth, runApi } from '../../api/run';

export default defineCommand({
  meta: {
    name: 'seasons',
    description: 'Generate season-appropriate pack suggestions for a location + date.',
  },
  args: {
    location: { type: 'string', required: true, description: 'Geocodable location string' },
    date: { type: 'string', required: true, description: 'ISO date or month label' },
  },
  async run({ args }) {
    await requireAuth();
    const client = await getUserClient();
    const data = await runApi({
      promise: client['season-suggestions'].post({ location: args.location, date: args.date }),
      action: 'season suggestions',
    });
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
  },
});
