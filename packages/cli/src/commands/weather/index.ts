import { defineCommand } from 'citty';
import consola from 'consola';
import { getUserClient } from '../../api/client';
import { asRecord } from '../../api/format';
import { requireAuth, runApi, tryApi } from '../../api/run';

const forecastCmd = defineCommand({
  meta: {
    name: 'forecast',
    description: 'Get a 10-day forecast for a location (name or lat,lon).',
  },
  args: {
    location: { type: 'positional', required: true, description: 'Location string' },
  },
  async run({ args }) {
    await requireAuth();
    const client = await getUserClient();
    const search = await tryApi(client.weather.search.get({ query: { q: args.location } }));
    if (!search.ok) {
      consola.error(`Could not search for "${args.location}" (HTTP ${search.status})`);
      process.exit(1);
    }
    const first = Array.isArray(search.data) ? asRecord(search.data[0]) : null;
    const id = first && 'id' in first ? first.id : null;
    if (id == null) {
      consola.error(`No matching weather location for "${args.location}".`);
      process.exit(1);
    }
    const forecast = await runApi(client.weather.forecast.get({ query: { id: String(id) } }), {
      action: 'get weather forecast',
    });
    process.stdout.write(`${JSON.stringify(forecast, null, 2)}\n`);
  },
});

const searchCmd = defineCommand({
  meta: { name: 'search', description: 'Search weather locations by name.' },
  args: { q: { type: 'positional', required: true, description: 'Location query' } },
  async run({ args }) {
    await requireAuth();
    const client = await getUserClient();
    const data = await runApi(client.weather.search.get({ query: { q: args.q } }), {
      action: 'search weather',
    });
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
  },
});

export default defineCommand({
  meta: { name: 'weather', description: 'Search weather locations + fetch forecasts.' },
  subCommands: {
    forecast: () => Promise.resolve(forecastCmd),
    search: () => Promise.resolve(searchCmd),
  },
});
