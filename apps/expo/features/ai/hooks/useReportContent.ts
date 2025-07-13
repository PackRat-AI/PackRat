import { useMutation } from '@tanstack/react-query';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
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

// API function
export const reportContent = async (
  payload: ReportContentPayload,
): Promise<ReportContentResponse> => {
  try {
    const response = await axiosInstance.post('/api/chat/reports', payload);
    return response.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to report content: ${message}`);
  }
};

// Hook
export function useReportContent() {
  return useMutation({
    mutationFn: (payload: ReportContentPayload) => reportContent(payload),
    onError: (error) => {
      console.error('Error reporting content:', error);
    },
  });
}
