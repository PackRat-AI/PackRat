import type { TrailConditionReportInput } from '../types';
import { placeDisplayName, placeTrailId, reportCoordinate, type SignedReport } from './trails';

/**
 * The rules of the report outbox, mirroring `OutboxService` and `TrailConditionsViewModel` in the
 * Swift app: a report written without signal, or whose send fails for a reason a retry can fix,
 * is queued with its photos and shows in the feed straight away until it sends.
 */

/** A photo on a queued report: already uploaded (an object key) or still only on the device. */
export type QueuedPhoto = { key: string } | { uri: string };

export interface QueuedReport {
  /** The id the server will get, so a send that landed before the drop can't duplicate. */
  id: string;
  input: Omit<TrailConditionReportInput, 'photos'>;
  photos: QueuedPhoto[];
  /** When the hiker wrote it. A replay keeps this time, not the time it sent. */
  writtenAt: string;
  /** The writer, so the queued report reads as theirs. */
  authorId: string | null;
  /** Send attempts that failed for a retryable reason. */
  attempts: number;
}

/** An API failure carrying the HTTP status, so the outbox can tell retryable from not. */
export class TrailConditionsRequestError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'TrailConditionsRequestError';
    this.status = status;
  }
}

/**
 * Whether a failed send is worth retrying. Anything without a status is a transport failure; a
 * timeout, rate limit or server error may pass next time. Any other 4xx means the server
 * rejected the report itself, and resending the same body can never succeed.
 */
export function isRetryableSendError(error: unknown): boolean {
  if (!(error instanceof TrailConditionsRequestError) || error.status == null) return true;
  const { status } = error;
  return status === 408 || status === 429 || status >= 500;
}

/** Whether every photo has been uploaded, so the report can go to the server as it is. */
export function photoKeys(photos: QueuedPhoto[]): string[] | null {
  const keys: string[] = [];
  for (const photo of photos) {
    if (!('key' in photo)) return null;
    keys.push(photo.key);
  }
  return keys;
}

/** A queued report as the feed shows it before the server has it. */
export function pendingReport(queued: QueuedReport): SignedReport {
  const coordinate = reportCoordinate(queued.input.place, queued.input.writtenFrom ?? null);
  return {
    id: queued.id,
    trailId: placeTrailId(queued.input.place),
    trailName: placeDisplayName(queued.input.place),
    trailRegion: null,
    latitude: coordinate?.latitude ?? null,
    longitude: coordinate?.longitude ?? null,
    surface: queued.input.surface,
    overallCondition: queued.input.overallCondition,
    hazards: queued.input.hazards,
    waterCrossings: 0,
    waterCrossingDifficulty: null,
    notes: queued.input.notes ?? null,
    // Only uploaded photos have a key the image loader can resolve; local ones show once sent.
    photos: queued.photos.flatMap((photo) => ('key' in photo ? [photo.key] : [])),
    userId: queued.authorId ?? undefined,
    tripId: queued.input.tripId ?? null,
    deleted: false,
    localCreatedAt: queued.writtenAt,
    localUpdatedAt: queued.writtenAt,
    authorName: null,
  };
}

/**
 * The feed with the hiker's unsent reports on top, newest first. A queued report the server
 * already has comes back in the feed, so it shows once.
 */
export function mergeQueuedIntoFeed(queued: QueuedReport[], feed: SignedReport[]): SignedReport[] {
  const sent = new Set(feed.map((report) => report.id));
  const unsent = queued
    .filter((report) => !sent.has(report.id))
    .sort((a, b) => b.writtenAt.localeCompare(a.writtenAt))
    .map(pendingReport);
  return [...unsent, ...feed];
}

/**
 * The feed's search: trail or pin name, region and notes, case-insensitive. Searching notes is
 * how someone finds "the trail with the washed out bridge" when they can't recall its name.
 */
export function filterReports<T extends Pick<SignedReport, 'trailName' | 'trailRegion' | 'notes'>>(
  reports: T[],
  searchText: string,
): T[] {
  const needle = searchText.trim().toLowerCase();
  if (!needle) return reports;
  return reports.filter((report) =>
    [report.trailName, report.trailRegion, report.notes].some((field) =>
      field?.toLowerCase().includes(needle),
    ),
  );
}
