import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type AdminFeedReport,
  type FeedReportAction,
  getFeedReports,
  resolveFeedReport,
  setFeedUserSuspended,
} from 'admin-app/lib/api';
import { queryKeys } from 'admin-app/lib/queryKeys';
import { toast } from 'sonner';

const reportsKey = queryKeys.admin.feedReports.all();

/** Stable identity for a queue row; a post and a comment can share a numeric id. */
export function reportKey(report: Pick<AdminFeedReport, 'targetType' | 'targetId'>): string {
  return `${report.targetType}:${report.targetId}`;
}

/**
 * Applies `update` to the cached queue, runs `commit`, and restores the
 * snapshot if `commit` throws.
 */
async function optimistically<T>({
  queryClient,
  update,
  commit,
}: {
  queryClient: QueryClient;
  update: (items: AdminFeedReport[]) => AdminFeedReport[];
  commit: () => Promise<T>;
}): Promise<T> {
  await queryClient.cancelQueries({ queryKey: reportsKey });
  const previous = queryClient.getQueryData<AdminFeedReport[]>(reportsKey);
  if (previous) queryClient.setQueryData(reportsKey, update(previous));
  try {
    return await commit();
  } catch (error) {
    queryClient.setQueryData(reportsKey, previous);
    throw error;
  }
}

export function useFeedReports() {
  return useQuery({ queryKey: reportsKey, queryFn: getFeedReports });
}

/**
 * Dismiss or remove one reported item. The row leaves the queue immediately and
 * comes back, with an error toast, if the API rejects the action.
 */
export function useResolveFeedReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ report, action }: { report: AdminFeedReport; action: FeedReportAction }) =>
      optimistically({
        queryClient,
        update: (items) => items.filter((item) => reportKey(item) !== reportKey(report)),
        commit: () =>
          resolveFeedReport({ targetType: report.targetType, targetId: report.targetId, action }),
      }),
    onError: (error, { action }) => {
      toast.error(action === 'remove' ? 'Could not remove item' : 'Could not dismiss reports', {
        description: error.message,
      });
    },
    onSuccess: (_data, { report, action }) => {
      const noun = report.targetType === 'post' ? 'Post' : 'Comment';
      toast.success(action === 'remove' ? `${noun} removed` : 'Reports dismissed');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: reportsKey }),
  });
}

/**
 * Suspend or reinstate an author. Every queued item by that author flips its
 * badge immediately and flips back on failure.
 */
export function useSetFeedUserSuspended() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, suspended }: { userId: string; suspended: boolean }) =>
      optimistically({
        queryClient,
        update: (items) =>
          items.map((item) =>
            item.author.id === userId ? { ...item, authorSuspended: suspended } : item,
          ),
        commit: () => setFeedUserSuspended({ userId, suspended }),
      }),
    onError: (error, { suspended }) => {
      toast.error(suspended ? 'Could not suspend account' : 'Could not reinstate account', {
        description: error.message,
      });
    },
    onSuccess: (_data, { suspended }) => {
      toast.success(suspended ? 'Account suspended' : 'Account reinstated');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: reportsKey }),
  });
}
