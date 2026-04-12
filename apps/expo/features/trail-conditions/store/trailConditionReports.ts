import { observable, syncState } from '@legendapp/state';
import { observablePersistSqlite } from '@legendapp/state/persist-plugins/expo-sqlite';
import { syncObservable } from '@legendapp/state/sync';
import { syncedCrud } from '@legendapp/state/sync-plugins/crud';
import { isAuthed } from 'expo-app/features/auth/store';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
import Storage from 'expo-sqlite/kv-store';
import type { TrailConditionReportInStore } from '../types';

// API calls for trail condition reports
const listMyReports = async (_params: unknown, { lastSync }: { lastSync?: number } = {}) => {
  try {
    const params: Record<string, string> = {};
    if (lastSync != null) {
      // Forward the cursor as an ISO datetime so the server can apply gte filter
      params.updatedAt = new Date(lastSync + 1).toISOString();
    }
    const res = await axiosInstance.get('/api/trail-conditions/mine', { params });
    return res.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to list trail condition reports: ${message}`);
  }
};

const createReport = async (reportData: TrailConditionReportInStore) => {
  try {
    const res = await axiosInstance.post('/api/trail-conditions', reportData);
    return res.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to create trail condition report: ${message}`);
  }
};

const updateReport = async ({
  id,
  ...data
}: { id: string } & Partial<Omit<TrailConditionReportInStore, 'id'>>) => {
  try {
    const res = await axiosInstance.put(`/api/trail-conditions/${id}`, data);
    return res.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to update trail condition report: ${message}`);
  }
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
      plugin: observablePersistSqlite(Storage as any),
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
