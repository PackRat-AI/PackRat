import { useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';

type UpdateReportStatusPayload = {
  id: string;
  status: 'reviewed' | 'dismissed';
};

export const updateReportStatus = async (
  payload: UpdateReportStatusPayload,
): Promise<{ success: boolean }> => {
  try {
    const response = await axiosInstance.patch(`/api/chat/reports/${payload.id}`, {
      status: payload.status,
    });
    return response.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to update report status: ${message}`);
  }
};

export function useUpdateReportStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateReportStatusPayload) => updateReportStatus(payload),
    onSuccess: () => {
      // Invalidate reported content queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['reportedContent'] });
    },
    onError: (error) => {
      console.error('Error updating report status:', error);
    },
  });
}
