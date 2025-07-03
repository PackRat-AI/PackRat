import { useQuery } from '@tanstack/react-query';
import { useUser } from '~/features/auth/hooks/useUser';
import type { User } from '~/features/profile/types';
import axiosInstance, { handleApiError } from '~/lib/api/client';
import { useAuthenticatedQueryToolkit } from '~/lib/hooks/useAuthenticatedQueryToolkit';

type ReportedContentResponse = {
  reportedItems: Array<{
    id: string;
    status: 'pending' | 'resolved' | 'dismissed';
    messageId: string;
    userQuery: string;
    aiResponse: string;
    reason: string;
    user: User;
    userComment?: string | null;
    createdAt: string;
  }>;
};

type ReportedContentCount = {
  count: number;
  total: number;
};

// API function for fetching reported content
export const getReportedContent = async (): Promise<ReportedContentResponse> => {
  try {
    const response = await axiosInstance.get('/api/chat/reports');
    return response.data;
  } catch (error) {
    const { message } = handleApiError(error);
    throw new Error(`Failed to fetch reported content: ${message}`);
  }
};

// Hook for fetching reported content count
export function useReportedContentCount() {
  const user = useUser();
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  return useQuery({
    queryKey: ['reportedContent', 'count'],
    enabled: isQueryEnabledWithAccessToken && user?.role === 'ADMIN',
    queryFn: async (): Promise<ReportedContentCount> => {
      const data = await getReportedContent();
      return {
        count: data.reportedItems.filter((item) => item.status === 'pending').length,
        total: data.reportedItems.length,
      };
    },
  });
}

// Hook for fetching all reported content
export function useReportedContent() {
  const user = useUser();
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  return useQuery({
    queryKey: ['reportedContent'],
    enabled: isQueryEnabledWithAccessToken && user?.role === 'ADMIN',
    queryFn: () => getReportedContent().then((data) => data.reportedItems),
  });
}
