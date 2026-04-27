import { useMutation } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';
import type { ReportReason } from '../lib/reportReasons';

type ReportContentPayload = {
  messageId: string;
  userQuery: string;
  aiResponse: string;
  reason: ReportReason;
  userComment?: string | null;
};

type ReportContentResponse = {
  success: boolean;
  reportId: string;
};

export const reportContent = async (
  payload: ReportContentPayload,
): Promise<ReportContentResponse> => {
  const { messageId: _messageId, userComment, ...rest } = payload;
  const { data, error } = await apiClient.chat.reports.post({
    ...rest,
    ...(userComment != null ? { userComment } : {}),
  });
  if (error) throw new Error(`Failed to report content: ${error.value}`);
  // safe-cast: treaty response shape matches ReportContentResponse as validated by the API schema
  return data as unknown as ReportContentResponse;
};

export function useReportContent() {
  return useMutation({
    mutationFn: (payload: ReportContentPayload) => reportContent(payload),
    onError: (error) => {
      console.error('Error reporting content:', error);
    },
  });
}
