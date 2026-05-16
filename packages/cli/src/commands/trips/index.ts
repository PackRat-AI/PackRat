import { defineCommand } from 'citty';
import { getUserClient } from '../../api/client';
import { asRecord, asRecordArray } from '../../api/format';
import { nowIso, shortId } from '../../api/ids';
import { requireAuth, runApi } from '../../api/run';
import { printSummary, printTable } from '../../shared';

const listCmd = defineCommand({
  meta: { name: 'list', description: 'List your trips.' },
  args: { json: { type: 'boolean', default: false } },
  async run({ args }) {
    await requireAuth();
    const client = await getUserClient();
    const trips = await runApi(client.trips.get(), { action: 'list trips' });
    if (args.json) {
      process.stdout.write(`${JSON.stringify(trips, null, 2)}\n`);
      return;
    }
    printTable(
      asRecordArray(trips).map((r) => ({
        id: r.id,
        name: r.name,
        startDate: r.startDate,
        endDate: r.endDate,
        packId: r.packId,
      })),
      { title: 'Your trips' },
    );
  },
});

const getCmd = defineCommand({
  meta: { name: 'get', description: 'Get a trip by ID.' },
  args: {
    id: { type: 'positional', required: true, description: 'Trip ID' },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    await requireAuth();
    const client = await getUserClient();
    const trip = await runApi(client.trips({ tripId: args.id }).get(), {
      action: 'get trip',
      resourceHint: `trip ${args.id}`,
    });
    if (args.json) {
      process.stdout.write(`${JSON.stringify(trip, null, 2)}\n`);
      return;
    }
    const t = asRecord(trip);
    printSummary(
      {
        id: t.id,
        name: t.name,
        description: t.description,
        startDate: t.startDate,
        endDate: t.endDate,
        packId: t.packId,
        notes: t.notes,
      },
      `Trip ${t.name ?? args.id}`,
    );
  },
});

const createCmd = defineCommand({
  meta: { name: 'create', description: 'Create a new trip.' },
  args: {
    name: { type: 'positional', required: true, description: 'Trip name' },
    description: { type: 'string', alias: 'd' },
    start: { type: 'string', description: 'ISO start date' },
    end: { type: 'string', description: 'ISO end date' },
    pack: { type: 'string', description: 'Optional pack ID to link' },
    notes: { type: 'string' },
    lat: { type: 'string' },
    lon: { type: 'string' },
    'location-name': { type: 'string' },
  },
  async run({ args }) {
    await requireAuth();
    const client = await getUserClient();
    const id = shortId('t');
    const now = nowIso();
    const lat = args.lat ? Number.parseFloat(args.lat) : null;
    const lon = args.lon ? Number.parseFloat(args.lon) : null;
    const location =
      lat != null && lon != null && !Number.isNaN(lat) && !Number.isNaN(lon)
        ? { latitude: lat, longitude: lon, name: args['location-name'] }
        : null;
    const trip = await runApi(
      client.trips.post({
        id,
        name: args.name,
        description: args.description,
        location,
        startDate: args.start,
        endDate: args.end,
        notes: args.notes,
        packId: args.pack,
        localCreatedAt: now,
        localUpdatedAt: now,
      }),
      { action: 'create trip' },
    );
    process.stdout.write(`${JSON.stringify(trip, null, 2)}\n`);
  },
});

const deleteCmd = defineCommand({
  meta: { name: 'delete', description: 'Delete a trip.' },
  args: { id: { type: 'positional', required: true, description: 'Trip ID' } },
  async run({ args }) {
    await requireAuth();
    const client = await getUserClient();
    await runApi(client.trips({ tripId: args.id }).delete(), {
      action: 'delete trip',
      resourceHint: `trip ${args.id}`,
    });
    process.stdout.write(`Deleted ${args.id}\n`);
  },
});

export default defineCommand({
  meta: { name: 'trips', description: 'List, create, and manage trips.' },
  subCommands: {
    list: () => Promise.resolve(listCmd),
    get: () => Promise.resolve(getCmd),
    create: () => Promise.resolve(createCmd),
    delete: () => Promise.resolve(deleteCmd),
  },
});
