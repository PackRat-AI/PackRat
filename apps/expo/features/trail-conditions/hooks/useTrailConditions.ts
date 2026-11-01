import { use$ } from '@legendapp/state/react';
import * as Sentry from '@sentry/react-native';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userStore } from 'expo-app/features/auth/store';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';
import * as Network from 'expo-network';
import { nanoid } from 'nanoid';
import { useMemo, useState } from 'react';
import {
  blockAuthor,
  createReport,
  deleteReport,
  flagReport,
  getTrail,
  listReports,
  searchTrails,
  trailReports,
  tripConditions,
} from '../lib/service';
import {
  discardQueuedReport,
  enqueueReport,
  flushReportOutbox,
  keepPhotoForQueue,
  reportOutboxStore,
} from '../store/reportOutbox';
import type { TrailConditionFlagReason, TrailConditionReportInput } from '../types';
import {
  filterReports,
  isRetryableSendError,
  mergeQueuedIntoFeed,
  pendingReport,
  type QueuedReport,
} from '../utils/outbox';
import type { Coordinate, SignedReport, TripConditions } from '../utils/trails';

export const trailConditionsQueryKey = ['trailConditionReports'] as const;
const trailQueryKey = (trailId: string) => ['trailConditionTrail', trailId] as const;
const trailReportsQueryKey = (trailId: string) => ['trailConditionTrailReports', trailId] as const;
export const tripConditionsQueryKey = (tripId: string) =>
  ['trailConditionTripReports', tripId] as const;

/** Every query that lists reports, so a write refreshes each screen that might show it. */
function invalidateReportLists(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: trailConditionsQueryKey });
  queryClient.invalidateQueries({ queryKey: ['trailConditionTrailReports'] });
  queryClient.invalidateQueries({ queryKey: ['trailConditionTripReports'] });
}

/** The hiker's reports still waiting to send, reactive to the outbox. */
export function useQueuedReports(): QueuedReport[] {
  // Legend mutates the record in place, so a plain `use$(store)` kept returning the same reference
  // and the list stayed stale until remount. A serialised snapshot changes on every enqueue or send.
  const snapshot = use$(() => JSON.stringify(reportOutboxStore.get() ?? {}));
  return useMemo(
    () => Object.values(JSON.parse(snapshot) as Record<string, QueuedReport>),
    [snapshot],
  );
}

/** Ids of the hiker's reports still waiting to send. */
export function usePendingReportIds(): Set<string> {
  const queued = useQueuedReports();
  return useMemo(() => new Set(queued.map((report) => report.id)), [queued]);
}

/**
 * The recent feed, with the hiker's unsent reports on top — the React Query counterpart of
 * `TrailConditionsViewModel.load` in the Swift app. Loading the feed also retries the outbox,
 * since a feed that loads means there is signal.
 */
export function useTrailConditions() {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();
  const queued = useQueuedReports();
  const [searchText, setSearchText] = useState('');

  const query = useQuery({
    queryKey: trailConditionsQueryKey,
    queryFn: async () => {
      // The feed loads whether or not the queue sends; a failed flush is reported, not thrown.
      await flushReportOutbox().catch((error) =>
        Sentry.captureException(error, {
          tags: { feature: 'trailConditions', action: 'flushBeforeFeed' },
        }),
      );
      return listReports();
    },
    enabled: isQueryEnabledWithAccessToken,
    staleTime: 1000 * 60 * 5,
  });

  const reports = useMemo(
    () => mergeQueuedIntoFeed(queued, query.data ?? []),
    [queued, query.data],
  );
  const filteredReports = useMemo(() => filterReports(reports, searchText), [reports, searchText]);

  return {
    reports,
    filteredReports,
    searchText,
    setSearchText,
    // A disabled query stays `pending` forever, so `isPending` alone would spin indefinitely for
    // a signed-out user. Gate on actual fetching — the caller renders the signed-out state from
    // `isQueryEnabledWithAccessToken` instead.
    isLoading: query.isLoading,
    isRefreshing: query.isRefetching,
    isSignedOut: !isQueryEnabledWithAccessToken,
    error: query.error,
    refetch: query.refetch,
  };
}

/** Trails for the picker: names matching `query`, nearest to `near` first. */
export function useTrailSearch({ query, near }: { query: string; near: Coordinate | null }) {
  const trimmed = query.trim();
  // Round the fix to ~100 m so GPS jitter doesn't refetch the list.
  const nearKey = near ? `${near.latitude.toFixed(3)},${near.longitude.toFixed(3)}` : null;
  return useQuery({
    queryKey: ['trailConditionTrailSearch', trimmed, nearKey],
    queryFn: () => searchTrails({ query: trimmed, near }),
    enabled: trimmed.length > 0 || near !== null,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 10,
  });
}

/** One trail with its line, for the trail page. */
export function useTrail(trailId: string) {
  return useQuery({
    queryKey: trailQueryKey(trailId),
    queryFn: () => getTrail(trailId),
    staleTime: 1000 * 60 * 60,
  });
}

/** Every report on a trail, newest first, with the hiker's unsent ones on top. */
export function useTrailReports(trailId: string) {
  const queued = useQueuedReports();
  const query = useQuery({
    queryKey: trailReportsQueryKey(trailId),
    queryFn: () => trailReports(trailId),
  });
  const reports = useMemo(
    () =>
      mergeQueuedIntoFeed(
        queued.filter(
          (report) =>
            report.input.place.kind === 'trail' && report.input.place.trail.id === trailId,
        ),
        query.data ?? [],
      ),
    [queued, query.data, trailId],
  );
  return { ...query, reports };
}

/** A trip's conditions section: its trail's reports, or those near its destination. */
export function useTripConditions(tripId: string, { enabled = true } = {}) {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();
  return useQuery({
    queryKey: tripConditionsQueryKey(tripId),
    queryFn: () => tripConditions(tripId),
    enabled: enabled && isQueryEnabledWithAccessToken,
  });
}

export interface SubmitReportArgs extends Omit<TrailConditionReportInput, 'photos'> {
  /** Picked photos as local file URIs. */
  photoUris: string[];
  /** Uploads one picked photo, reporting progress. Absent when there are none. */
  upload: (uri: string, index: number) => Promise<string>;
}

/**
 * Submits a report. Mirrors `submitReport` on the Swift view model: without signal, or when the
 * send fails for a reason a retry can fix, the report is queued with its photos and shows in the
 * feed straight away. Only a report the server rejects outright throws.
 */
export function useSubmitTrailConditionReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ photoUris, upload, ...input }: SubmitReportArgs) => {
      const id = nanoid();
      const writtenAt = new Date().toISOString();
      const network = await Network.getNetworkStateAsync();
      const online = network.isInternetReachable !== false && network.isConnected !== false;

      let uploaded: string[] = [];
      if (online) {
        try {
          uploaded = await Promise.all(photoUris.map((uri, index) => upload(uri, index)));
          await createReport({ id, input: { ...input, photos: uploaded }, writtenAt });
          return { queued: false };
        } catch (error) {
          if (!isRetryableSendError(error)) throw error;
          Sentry.addBreadcrumb({
            category: 'trailConditions',
            message: 'Report send failed; queueing',
            level: 'info',
            data: { reportId: id },
          });
        }
      }

      const photos = await Promise.all(
        photoUris.map((uri, index) => {
          const key = uploaded[index];
          return key ? { key } : keepPhotoForQueue({ reportId: id, index, uri });
        }),
      );
      enqueueReport({
        id,
        input,
        photos,
        writtenAt,
        authorId: userStore.peek()?.id ?? null,
        attempts: 0,
      });
      return { queued: true };
    },
    onSuccess: () => invalidateReportLists(queryClient),
  });
}

/**
 * Deletes one of the hiker's reports. A report still in the outbox never reached the server, so
 * dropping it from the queue is the delete.
 */
export function useDeleteTrailConditionReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (reportOutboxStore.peek()[id]) {
        await discardQueuedReport(id);
        return;
      }
      await deleteReport(id);
    },
    onSuccess: () => invalidateReportLists(queryClient),
  });
}

/** Flags someone else's report. The server hides it from the flagger at once. */
export function useFlagTrailConditionReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: TrailConditionFlagReason }) =>
      flagReport(id, reason),
    onSuccess: () => invalidateReportLists(queryClient),
  });
}

/** Blocks a report's author. Shared with the feed, so posts refresh too. */
export function useBlockReportAuthor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => blockAuthor(userId),
    onSuccess: () => {
      invalidateReportLists(queryClient);
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

/**
 * A report from any list already loaded — the feed, a trail page, a trip section — or the outbox.
 * There is no single-report endpoint, and the hiker always arrives at a report from one of those.
 */
export function useCachedReport(reportId: string): SignedReport | undefined {
  const queryClient = useQueryClient();
  const queued = useQueuedReports();
  const feed = useTrailConditions();
  return useMemo(() => {
    const fromQueue = queued.find((report) => report.id === reportId);
    if (fromQueue) return pendingReport(fromQueue);
    const fromFeed = feed.reports.find((report) => report.id === reportId);
    if (fromFeed) return fromFeed;
    for (const [, data] of queryClient.getQueriesData<SignedReport[] | TripConditions>({
      predicate: ({ queryKey }) =>
        queryKey[0] === 'trailConditionTrailReports' || queryKey[0] === 'trailConditionTripReports',
    })) {
      const reports = Array.isArray(data) ? data : data?.reports;
      const found = reports?.find((report) => report.id === reportId);
      if (found) return found;
    }
    return undefined;
  }, [feed.reports, queryClient, queued, reportId]);
}
