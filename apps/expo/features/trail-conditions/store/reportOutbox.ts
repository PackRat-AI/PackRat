import { observable } from '@legendapp/state';
import { syncObservable } from '@legendapp/state/sync';
import * as Sentry from '@sentry/react-native';
import { uploadImage } from 'expo-app/features/packs/utils';
import { restoreTripDateStrings } from 'expo-app/features/trips/utils/tripStoreDates';
import { persistPlugin } from 'expo-app/lib/persist-plugin';
import { obs } from 'expo-app/lib/store';
import * as FileSystem from 'expo-file-system/legacy';
import { createReport } from '../lib/service';
import {
  isQueuedReport,
  isRetryableSendError,
  type QueuedPhoto,
  type QueuedReport,
} from '../utils/outbox';

/**
 * Reports waiting to send, by id — the counterpart of the trail-report `PendingMutation` rows the
 * Swift `OutboxService` keeps. Persisted, so a report written without signal survives a relaunch
 * and keeps showing in the feed until it sends.
 */
export const reportOutboxStore = observable<Record<string, QueuedReport>>({});

syncObservable(reportOutboxStore, {
  persist: {
    plugin: persistPlugin,
    name: 'trailReportOutbox',
    // The cache revives ISO timestamps as `Date`s on load; `writtenAt` must stay a string.
    transform: { load: restoreTripDateStrings },
  },
});

const PHOTO_DIR = `${FileSystem.documentDirectory ?? ''}trail-report-photos/`;

/**
 * Copies a picked photo out of the picker's cache, which the system may clear, into the app's
 * own storage where it waits for the report to send. Mirrors `PendingReportPhotos.save`.
 */
export async function keepPhotoForQueue({
  reportId,
  index,
  uri,
}: {
  reportId: string;
  index: number;
  uri: string;
}): Promise<QueuedPhoto> {
  const dir = `${PHOTO_DIR}${reportId}/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const to = `${dir}${index}.jpg`;
  await FileSystem.copyAsync({ from: uri, to });
  return { uri: to };
}

async function removeQueuedPhotos(reportId: string): Promise<void> {
  await FileSystem.deleteAsync(`${PHOTO_DIR}${reportId}/`, { idempotent: true });
}

export function enqueueReport(report: QueuedReport): void {
  obs({ store: reportOutboxStore, id: report.id }).set(report);
}

/** Drops a queued report and its photos: for an unsent report, that is the delete. */
export async function discardQueuedReport(id: string): Promise<void> {
  obs({ store: reportOutboxStore, id }).delete();
  await removeQueuedPhotos(id);
}

/** Uploads the queued photos that are still only on the device, recording each key as it lands. */
async function uploadQueuedPhotos(report: QueuedReport): Promise<string[]> {
  const keys: string[] = [];
  for (const [index, photo] of report.photos.entries()) {
    if ('key' in photo) {
      keys.push(photo.key);
      continue;
    }
    const key = await uploadImage({
      fileName: `trail-report-${report.id}-${index}.jpg`,
      uri: photo.uri,
    });
    if (!key) throw new Error('Photo upload returned no key');
    if (reportOutboxStore.peek()[report.id]) {
      obs({ store: reportOutboxStore, id: report.id }).photos[index]?.set({ key });
    }
    keys.push(key);
  }
  return keys;
}

async function sendQueuedReport(report: QueuedReport): Promise<void> {
  try {
    const photos = await uploadQueuedPhotos(report);
    await createReport({
      id: report.id,
      input: { ...report.input, photos },
      writtenAt: report.writtenAt,
    });
    await discardQueuedReport(report.id);
  } catch (error) {
    if (isRetryableSendError(error)) {
      // Only while it is still queued: setting a field on a removed entry recreates a partial one.
      if (reportOutboxStore.peek()[report.id]) {
        obs({ store: reportOutboxStore, id: report.id }).attempts.set(report.attempts + 1);
      }
      return;
    }
    // The server rejected the report itself; resending the same body can never succeed.
    Sentry.captureException(error, {
      tags: { feature: 'trailConditions', action: 'dropQueuedReport' },
      extra: { reportId: report.id, attempts: report.attempts },
    });
    await discardQueuedReport(report.id);
  }
}

let flushing: Promise<number> | null = null;

/**
 * Sends every queued report, oldest first. Returns how many sent. Concurrent calls share one run,
 * so a foreground and a pull-to-refresh can't send the same report twice.
 */
export function flushReportOutbox(): Promise<number> {
  if (flushing) return flushing;
  flushing = (async () => {
    for (const [id, entry] of Object.entries(reportOutboxStore.peek())) {
      if (!isQueuedReport(entry)) obs({ store: reportOutboxStore, id }).delete();
    }
    const queued = Object.values(reportOutboxStore.peek())
      .filter(isQueuedReport)
      .sort((a, b) => a.writtenAt.localeCompare(b.writtenAt));
    for (const report of queued) {
      try {
        await sendQueuedReport(report);
      } catch (error) {
        // One bad entry must not hold up the rest of the queue.
        Sentry.captureException(error, {
          tags: { feature: 'trailConditions', action: 'flushReportOutbox' },
          extra: { reportId: report.id },
        });
      }
    }
    return queued.length - Object.keys(reportOutboxStore.peek()).length;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}
