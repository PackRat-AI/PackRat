import { observable, syncState } from '@legendapp/state';
import { syncObservable } from '@legendapp/state/sync';
import { syncedCrud } from '@legendapp/state/sync-plugins/crud';
import { type TripStatsEntry, TripStatsEntrySchema } from '@packrat/schemas/tripStats';
import { isAuthed } from 'expo-app/features/auth/store';
import { apiClient } from 'expo-app/lib/api/packrat';
import { persistPlugin } from 'expo-app/lib/persist-plugin';

export const tripStatsEntriesStore = observable<Record<string, TripStatsEntry>>({});

/** Create and replace both carry the whole entry. */
function entryBody(entry: TripStatsEntry) {
  return {
    kind: entry.kind,
    parkCode: entry.parkCode ?? null,
    name: entry.name ?? null,
    elevationMeters: entry.elevationMeters ?? null,
    latitude: entry.latitude ?? null,
    longitude: entry.longitude ?? null,
    osmId: entry.osmId ?? null,
    date: entry.date ?? null,
  };
}

const listEntries = async () => {
  const { data, error } = await apiClient['trip-stats'].entries.get();
  if (error) throw new Error(`Failed to list trip stats entries: ${error.value}`);
  return TripStatsEntrySchema.array().parse(data);
};

const createEntry = async (entry: TripStatsEntry) => {
  const now = new Date().toISOString();
  const { data, error, status } = await apiClient['trip-stats'].entries.post({
    id: entry.id,
    ...entryBody(entry),
    localCreatedAt: entry.localCreatedAt ?? now,
    localUpdatedAt: entry.localUpdatedAt ?? now,
  });
  // A retried create the server already holds is a success.
  if (status === 409) return entry;
  if (error) throw new Error(`Failed to create trip stats entry: ${error.value}`);
  return TripStatsEntrySchema.parse(data);
};

const updateEntry = async (changes: Partial<TripStatsEntry>) => {
  // Changes can be partial; the server replaces the whole entry, so send the stored one with them.
  const id = String(changes.id);
  const stored = tripStatsEntriesStore.peek()[id];
  if (!stored) throw new Error(`Trip stats entry ${id} is not in the store`);
  const entry: TripStatsEntry = { ...stored, ...changes };
  if (entry.deleted) {
    const { error, status } = await apiClient['trip-stats'].entries({ entryId: id }).delete();
    if (error && status !== 404)
      throw new Error(`Failed to delete trip stats entry: ${error.value}`);
    return entry;
  }
  const { data, error } = await apiClient['trip-stats'].entries({ entryId: id }).put({
    ...entryBody(entry),
    localUpdatedAt: entry.localUpdatedAt ?? new Date().toISOString(),
  });
  if (error) throw new Error(`Failed to update trip stats entry: ${error.value}`);
  return TripStatsEntrySchema.parse(data);
};

syncObservable(
  tripStatsEntriesStore,
  syncedCrud({
    fieldUpdatedAt: 'updatedAt',
    fieldCreatedAt: 'createdAt',
    fieldDeleted: 'deleted',
    // The server lists live entries only, so a full replace is how a delete made on another
    // device reaches this one. Pending local changes are kept on top of it.
    mode: 'set',
    persist: { plugin: persistPlugin, retrySync: true, name: 'tripStatsEntries' },
    waitFor: isAuthed,
    waitForSet: isAuthed,
    retry: { infinite: true, backoff: 'exponential', maxDelay: 30000 },
    list: listEntries,
    create: createEntry,
    update: updateEntry,
  }),
);

export const tripStatsEntriesSyncState = syncState(tripStatsEntriesStore);
