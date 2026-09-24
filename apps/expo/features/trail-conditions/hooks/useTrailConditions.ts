import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';
import { useCallback, useMemo, useState } from 'react';
import { createReport, deleteReport, listReports } from '../lib/service';
import { isLocalReport, type TrailConditionReport, type TrailConditionReportInput } from '../types';

export const trailConditionsQueryKey = ['trailConditionReports'] as const;

/**
 * Server state for the trail conditions list, plus the search filter — the React Query
 * counterpart of `TrailConditionsViewModel` in the Swift app.
 *
 * The Swift view model hand-rolls `reports` / `isLoading` / `error` because SwiftUI has no query
 * cache; here React Query owns exactly those three, so this hook only adds what it does not:
 * the search text and the derived filter.
 */
export function useTrailConditions() {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();
  const [searchText, setSearchText] = useState('');

  const query = useQuery({
    queryKey: trailConditionsQueryKey,
    queryFn: () => listReports(),
    enabled: isQueryEnabledWithAccessToken,
    staleTime: 1000 * 60 * 5,
  });

  const reports = useMemo(() => query.data ?? [], [query.data]);

  /**
   * Matches `filteredReports` in the Swift view model: name, region and notes, case-insensitive.
   * Searching notes is deliberate — it is how someone finds "the trail with the washed out
   * bridge" when they cannot recall its name.
   */
  const filteredReports = useMemo(() => {
    const needle = searchText.trim().toLowerCase();
    if (!needle) return reports;
    return reports.filter((report) =>
      [report.trailName, report.trailRegion, report.notes].some((field) =>
        field?.toLowerCase().includes(needle),
      ),
    );
  }, [reports, searchText]);

  return {
    reports,
    filteredReports,
    searchText,
    setSearchText,
    isLoading: query.isPending,
    isRefreshing: query.isRefetching,
    error: query.error,
    refetch: query.refetch,
  };
}

/** Submits a new report and refreshes the list. Mirrors `submitReport` on the Swift view model. */
export function useSubmitTrailConditionReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TrailConditionReportInput) => createReport(input),
    onSuccess: (report) => {
      // Show the new report immediately rather than waiting for the refetch, matching the Swift
      // view model's `reports.insert(report, at: 0)`.
      queryClient.setQueryData<TrailConditionReport[]>(trailConditionsQueryKey, (current) => [
        report,
        ...(current ?? []).filter((existing) => existing.id !== report.id),
      ]);
      queryClient.invalidateQueries({ queryKey: trailConditionsQueryKey });
    },
  });
}

/**
 * Deletes a report. Mirrors `deleteReport` on the Swift view model, including its short-circuit
 * for `local-` ids: a report that never reached the server is removed from the cache instead of
 * being DELETEd, which would 403.
 */
export function useDeleteTrailConditionReport() {
  const queryClient = useQueryClient();

  const removeFromCache = useCallback(
    (id: string) => {
      queryClient.setQueryData<TrailConditionReport[]>(trailConditionsQueryKey, (current) =>
        (current ?? []).filter((report) => report.id !== id),
      );
    },
    [queryClient],
  );

  return useMutation({
    mutationFn: async (id: string) => {
      if (isLocalReport(id)) return;
      await deleteReport(id);
    },
    onSuccess: (_result, id) => {
      removeFromCache(id);
      queryClient.invalidateQueries({ queryKey: trailConditionsQueryKey });
    },
  });
}
