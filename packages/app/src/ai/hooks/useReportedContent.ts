import { useUser } from '@packrat/app/auth/hooks/useUser';
import { apiClient } from '@packrat/app/lib/api/packrat';
import { useAuthenticatedQueryToolkit } from '@packrat/app/lib/hooks/useAuthenticatedQueryToolkit';
import type { User } from '@packrat/app/profile';
import { useQuery } from '@tanstack/react-query';

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

export const getReportedContent = async (): Promise<ReportedContentResponse> => {
  const { data, error } = await apiClient.chat.reports.get();
  if (error) throw new Error(`Failed to fetch reported content: ${error.value}`);
  // safe-cast: treaty response shape matches ReportedContentResponse as validated by the API schema
  return data as unknown as ReportedContentResponse;
};

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

export function useReportedContent() {
  const user = useUser();
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  return useQuery({
    queryKey: ['reportedContent'],
    enabled: isQueryEnabledWithAccessToken && user?.role === 'ADMIN',
    queryFn: () => getReportedContent().then((data) => data.reportedItems),
  });
}
