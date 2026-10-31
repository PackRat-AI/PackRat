import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type AdminTrailFlag,
  type FeedReportAction,
  getTrailFlags,
  resolveTrailFlags,
} from 'admin-app/lib/api';
import { queryKeys } from 'admin-app/lib/queryKeys';
import { toast } from 'sonner';

const flagsKey = queryKeys.admin.trailFlags.all();

export function useTrailFlags() {
  return useQuery({ queryKey: flagsKey, queryFn: getTrailFlags });
}

/**
 * Dismiss or remove one flagged trail report. The row leaves the queue
 * immediately and comes back, with an error toast, if the API rejects it.
 */
export function useResolveTrailFlags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ flag, action }: { flag: AdminTrailFlag; action: FeedReportAction }) => {
      await queryClient.cancelQueries({ queryKey: flagsKey });
      const previous = queryClient.getQueryData<AdminTrailFlag[]>(flagsKey);
      if (previous) {
        queryClient.setQueryData(
          flagsKey,
          previous.filter((item) => item.reportId !== flag.reportId),
        );
      }
      try {
        return await resolveTrailFlags({ reportId: flag.reportId, action });
      } catch (error) {
        queryClient.setQueryData(flagsKey, previous);
        throw error;
      }
    },
    onError: (error, { action }) => {
      toast.error(action === 'remove' ? 'Could not remove report' : 'Could not dismiss flags', {
        description: error.message,
      });
    },
    onSuccess: (_data, { action }) => {
      toast.success(action === 'remove' ? 'Report removed' : 'Flags dismissed');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: flagsKey }),
  });
}
