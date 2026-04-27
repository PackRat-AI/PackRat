import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from 'app/lib/api/packrat';

type UpdateReportStatusPayload = {
  id: string;
  status: 'reviewed' | 'dismissed';
};

export const updateReportStatus = async (
  payload: UpdateReportStatusPayload,
): Promise<{ success: boolean }> => {
  const { data, error } = await apiClient.chat.reports({ id: payload.id }).patch({
    status: payload.status,
  });
  if (error) throw new Error(`Failed to update report status: ${error.value}`);
  return data as unknown as { success: boolean };
};

export function useUpdateReportStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateReportStatusPayload) => updateReportStatus(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reportedContent'] });
    },
    onError: (error) => {
      console.error('Error updating report status:', error);
    },
  });
}
