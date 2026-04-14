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
  const { data, error } = await apiClient['trail-conditions'].post(reportData as never);
  if (error) throw new Error(`Failed to create trail condition report: ${error.value}`);
  return data as object | null;
};

const updateReport = async ({
  id,
  ...data
}: { id: string } & Partial<Omit<TrailConditionReportInStore, 'id'>>) => {
  const { data: result, error } = await apiClient['trail-conditions']({
    reportId: String(id),
  }).put(data as never);
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
      plugin: observablePersistSqlite(
        Storage as unknown as Parameters<typeof observablePersistSqlite>[0],
      ),
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
