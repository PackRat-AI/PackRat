import { defineCommand } from 'citty';
import { getUserClient } from '../../api/client';
import { requireAuth, runApi } from '../../api/run';
import { printTable } from '../../shared';

const searchCmd = defineCommand({
  meta: { name: 'search', description: 'Search OSM trails by name, sport, or geography.' },
  args: {
    q: { type: 'string', description: 'Text query' },
    lat: { type: 'string', description: 'Latitude (with --lon for spatial search)' },
    lon: { type: 'string', description: 'Longitude' },
    radius: { type: 'string', description: 'Search radius in km' },
    sport: { type: 'string' },
    limit: { type: 'string', default: '20' },
    offset: { type: 'string', default: '0' },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    await requireAuth();
    const client = await getUserClient();
    const data = await runApi(
      client.trails.search.get({
        query: {
          q: args.q,
          lat: args.lat ? Number.parseFloat(args.lat) : undefined,
          lon: args.lon ? Number.parseFloat(args.lon) : undefined,
          radius: args.radius ? Number.parseFloat(args.radius) : undefined,
          sport: args.sport,
          limit: Number.parseInt(args.limit, 10),
          offset: Number.parseInt(args.offset, 10),
        },
      }),
      { action: 'search trails' },
    );
    if (args.json) {
      process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
      return;
    }
    const trails = Array.isArray((data as Record<string, unknown>).trails)
      ? ((data as Record<string, unknown>).trails as Record<string, unknown>[])
      : [];
    printTable(
      trails.map((t) => ({
        osmId: t.osmId,
        name: t.name,
        sport: t.sport,
        distance: t.distance,
      })),
      { title: 'Trails' },
    );
  },
});

const getCmd = defineCommand({
  meta: { name: 'get', description: 'Get trail metadata by OSM ID.' },
  args: { id: { type: 'positional', required: true, description: 'OSM relation ID' } },
  async run({ args }) {
    await requireAuth();
    const client = await getUserClient();
    const trail = await runApi(client.trails({ osmId: args.id }).get(), {
      action: 'get trail',
      resourceHint: `trail ${args.id}`,
    });
    process.stdout.write(`${JSON.stringify(trail, null, 2)}\n`);
  },
});

const geometryCmd = defineCommand({
  meta: { name: 'geometry', description: 'Full GeoJSON geometry for a trail.' },
  args: { id: { type: 'positional', required: true, description: 'OSM relation ID' } },
  async run({ args }) {
    await requireAuth();
    const client = await getUserClient();
    const data = await runApi(client.trails({ osmId: args.id }).geometry.get(), {
      action: 'get trail geometry',
      resourceHint: `trail ${args.id}`,
    });
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
  },
});

export default defineCommand({
  meta: { name: 'trails', description: 'OSM trail search and details.' },
  subCommands: {
    search: () => Promise.resolve(searchCmd),
    get: () => Promise.resolve(getCmd),
    geometry: () => Promise.resolve(geometryCmd),
  },
});
