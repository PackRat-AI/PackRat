import { observable, syncState } from '@legendapp/state';
import { observablePersistSqlite } from '@legendapp/state/persist-plugins/expo-sqlite';
import { syncObservable } from '@legendapp/state/sync';
import { syncedCrud } from '@legendapp/state/sync-plugins/crud';
import { isAuthed } from 'expo-app/features/auth/store';
import { apiClient } from 'expo-app/lib/api/packrat';
import Storage from 'expo-sqlite/kv-store';
import type { TrailConditionReportInStore } from '../types';

const listMyReports = async (_params: unknown, { lastSync }: { lastSync?: number } = {}) => {
  const { data, error } = await apiClient['trail-conditions'].mine.get({
    query: lastSync != null ? { updatedAt: new Date(lastSync + 1).toISOString() } : {},
  });
  if (error) throw new Error(`Failed to list trail condition reports: ${error.value}`);
  return data as object[] | null;
};

const createReport = async (reportData: TrailConditionReportInStore) => {
  const { data, error } = await apiClient['trail-conditions'].post({
    id: reportData.id,
    trailName: reportData.trailName,
    surface: reportData.surface,
    overallCondition: reportData.overallCondition,
    trailRegion: reportData.trailRegion ?? null,
    hazards: reportData.hazards,
    waterCrossings: reportData.waterCrossings,
    waterCrossingDifficulty: reportData.waterCrossingDifficulty ?? null,
    notes: reportData.notes ?? null,
    photos: reportData.photos,
    tripId: reportData.tripId ?? null,
    localCreatedAt: reportData.localCreatedAt ?? new Date().toISOString(),
    localUpdatedAt: reportData.localUpdatedAt ?? new Date().toISOString(),
  });
  if (error) throw new Error(`Failed to create trail condition report: ${error.value}`);
  return data as object | null;
};

const updateReport = async ({
  id,
  ...data
}: { id: string } & Partial<Omit<TrailConditionReportInStore, 'id'>>) => {
  const { data: result, error } = await apiClient['trail-conditions']({
    reportId: String(id),
  }).put({
    ...(data.trailName !== undefined ? { trailName: data.trailName } : {}),
    ...(data.trailRegion !== undefined ? { trailRegion: data.trailRegion } : {}),
    ...(data.surface !== undefined ? { surface: data.surface } : {}),
    ...(data.overallCondition !== undefined ? { overallCondition: data.overallCondition } : {}),
    ...(data.hazards !== undefined ? { hazards: data.hazards } : {}),
    ...(data.waterCrossings !== undefined ? { waterCrossings: data.waterCrossings } : {}),
    ...(data.waterCrossingDifficulty !== undefined
      ? { waterCrossingDifficulty: data.waterCrossingDifficulty }
      : {}),
    ...(data.notes !== undefined ? { notes: data.notes } : {}),
    ...(data.photos !== undefined ? { photos: data.photos } : {}),
    ...(data.tripId !== undefined ? { tripId: data.tripId } : {}),
    ...(data.deleted !== undefined ? { deleted: data.deleted } : {}),
    ...(data.localUpdatedAt ? { localUpdatedAt: data.localUpdatedAt } : {}),
  });
  if (error) throw new Error(`Failed to update trail condition report: ${error.value}`);
  return result as object | null;
};

// Observable trail condition reports store
export const trailConditionReportsStore = observable<Record<string, TrailConditionReportInStore>>(
  {},
);

// Sync store with backend
syncObservable(
  trailConditionReportsStore,
  syncedCrud({
    fieldUpdatedAt: 'updatedAt',
    fieldCreatedAt: 'createdAt',
    fieldDeleted: 'deleted',
    mode: 'merge',
    persist: {
      plugin: observablePersistSqlite(Storage),
      retrySync: true,
      name: 'trail_condition_reports',
    },
    waitFor: isAuthed,
    waitForSet: isAuthed,
    retry: {
      infinite: true,
      backoff: 'exponential',
      maxDelay: 30000,
    },
    list: listMyReports,
    create: createReport,
    update: updateReport,
    changesSince: 'last-sync',
  }),
);

export const trailConditionReportsSyncState = syncState(trailConditionReportsStore);
