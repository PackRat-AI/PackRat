import { safeJsonStringify } from '@packrat/utils';
import { defineCommand } from 'citty';
import { getUserClient } from '../../api/client';
import { requireAuth, runApi } from '../../api/run';

const forecastCmd = defineCommand({
  meta: {
    name: 'forecast',
    description: 'Get a 10-day forecast for a named location (single API call).',
  },
  args: {
    location: { type: 'positional', required: true, description: 'Location string' },
  },
  async run({ args }) {
    await requireAuth();
    const client = await getUserClient();
    const forecast = await runApi({
      promise: client.weather['by-name'].get({ query: { q: args.location } }),
      action: 'get weather forecast',
      resourceHint: args.location,
    });
    process.stdout.write(`${safeJsonStringify(forecast, null, 2)}\n`);
  },
});

const searchCmd = defineCommand({
  meta: { name: 'search', description: 'Search weather locations by name.' },
  args: { q: { type: 'positional', required: true, description: 'Location query' } },
  async run({ args }) {
    await requireAuth();
    const client = await getUserClient();
    const data = await runApi({
      promise: client.weather.search.get({ query: { q: args.q } }),
      action: 'search weather',
    });
    process.stdout.write(`${safeJsonStringify(data, null, 2)}\n`);
  },
});

export default defineCommand({
  meta: { name: 'weather', description: 'Search weather locations + fetch forecasts.' },
  subCommands: {
    forecast: () => Promise.resolve(forecastCmd),
    search: () => Promise.resolve(searchCmd),
  },
});
