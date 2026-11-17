import * as Sentry from '@sentry/react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import {
  markReportsRead,
  setTrailReportNotificationsEnabled,
  trailReportNotificationsEnabled,
  unreadTripIds,
} from '../lib/service';

export const unreadTripsQueryKey = ['trailConditionUnreadTrips'] as const;
export const trailReportNotificationsQueryKey = ['trailConditionNotificationSettings'] as const;

/**
 * Unread markers, the Trail Reports setting and report pushes — `TrailReportUnreadStore.isEnabled`
 * in the Swift app. Needs trail conditions on as well as its own flag.
 */
export function useTrailReportAlertsEnabled(): boolean {
  const conditions = useFeatureFlag('enableTrailConditions');
  const alerts = useFeatureFlag('enableTrailConditionNotifications');
  return conditions && alerts;
}

/**
 * Which of the hiker's upcoming and in-progress trips have a trail report they haven't read, so
 * the trip list can mark them. Reading a report, on the trip or anywhere else, clears it. Refreshes
 * whenever the calling screen comes into focus.
 */
export function useUnreadTripIds(): Set<string> {
  const enabled = useTrailReportAlertsEnabled();
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();
  const active = enabled && isQueryEnabledWithAccessToken;
  const query = useQuery({
    queryKey: unreadTripsQueryKey,
    queryFn: unreadTripIds,
    enabled: active,
    // A failed refresh keeps the markers already shown.
    retry: false,
  });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      if (active) refetch();
    }, [active, refetch]),
  );
  const data = active ? query.data : undefined;
  return useMemo(() => new Set(data ?? []), [data]);
}

/** Records reports as read; the trip they were read on loses its marker at once. */
export function useMarkReportsRead() {
  const queryClient = useQueryClient();
  const enabled = useTrailReportAlertsEnabled();
  const mutation = useMutation({
    mutationFn: ({ reportIds }: { reportIds: string[]; tripId?: string }) =>
      markReportsRead(reportIds),
    onMutate: ({ tripId }) => {
      if (!tripId) return;
      queryClient.setQueryData<string[]>(unreadTripsQueryKey, (ids) =>
        ids?.filter((id) => id !== tripId),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: unreadTripsQueryKey }),
  });
  const { mutate } = mutation;
  return useMemo(
    () =>
      ({ reportIds, tripId }: { reportIds: string[]; tripId?: string }) => {
        if (!enabled || reportIds.length === 0) return;
        // Best effort: a read that doesn't reach the server leaves the marker for next time.
        mutate({ reportIds, tripId }, { onError: () => undefined });
      },
    [enabled, mutate],
  );
}

/** The server-side Trail Reports switch. `enabled` is undefined until it has loaded. */
export function useTrailReportNotificationsSetting({ active }: { active: boolean }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: trailReportNotificationsQueryKey,
    queryFn: trailReportNotificationsEnabled,
    enabled: active,
  });
  const mutation = useMutation({
    mutationFn: setTrailReportNotificationsEnabled,
    onMutate: async (enabled) => {
      await queryClient.cancelQueries({ queryKey: trailReportNotificationsQueryKey });
      queryClient.setQueryData(trailReportNotificationsQueryKey, enabled);
    },
    // A save that failed puts the switch back to what the server holds.
    onError: () => {
      Sentry.addBreadcrumb({
        category: 'trailConditions',
        message: 'Trail Reports setting failed to save; reloading',
        level: 'warning',
      });
      queryClient.invalidateQueries({ queryKey: trailReportNotificationsQueryKey });
    },
  });
  return { enabled: active ? query.data : undefined, setEnabled: mutation.mutate };
}
