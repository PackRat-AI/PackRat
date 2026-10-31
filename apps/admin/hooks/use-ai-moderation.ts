import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type AdminAiReport,
  type AdminAiReportAction,
  getAiReports,
  resolveAiReport,
} from 'admin-app/lib/api';
import { queryKeys } from 'admin-app/lib/queryKeys';
import { toast } from 'sonner';

const reportsKey = queryKeys.admin.aiReports.all();

export function useAiReports() {
  return useQuery({ queryKey: reportsKey, queryFn: getAiReports });
}

/**
 * Dismiss or resolve one reported AI answer. The row leaves the queue
 * immediately and comes back, with an error toast, if the API rejects it.
 */
export function useResolveAiReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      report,
      action,
    }: {
      report: AdminAiReport;
      action: AdminAiReportAction;
    }) => {
      await queryClient.cancelQueries({ queryKey: reportsKey });
      const previous = queryClient.getQueryData<AdminAiReport[]>(reportsKey);
      if (previous) {
        queryClient.setQueryData(
          reportsKey,
          previous.filter((item) => item.id !== report.id),
        );
      }
      try {
        return await resolveAiReport({ id: report.id, action });
      } catch (error) {
        queryClient.setQueryData(reportsKey, previous);
        throw error;
      }
    },
    onError: (error, { action }) => {
      toast.error(action === 'resolve' ? 'Could not resolve report' : 'Could not dismiss report', {
        description: error.message,
      });
    },
    onSuccess: (_data, { action }) => {
      toast.success(action === 'resolve' ? 'Report resolved' : 'Report dismissed');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: reportsKey }),
  });
}
