import * as Sentry from '@sentry/react-native';
import { useQuery } from '@tanstack/react-query';
import { useUser } from 'expo-app/features/auth/hooks/useUser';
import type { User } from 'expo-app/features/profile/types';
import { apiClient } from 'expo-app/lib/api/packrat';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';

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

export type ReportedContentItem = ReportedContentResponse['reportedItems'][number];

type ReportedContentCount = {
  count: number;
  total: number;
};

export const getReportedContent = async (): Promise<ReportedContentResponse> => {
  const { data, error } = await apiClient.chat.reports.get();
  if (error) {
    const err = new Error(String(error.value ?? 'Failed to fetch reported content'));
    Sentry.captureException(err, {
      tags: { feature: 'ai', action: 'getReportedContent' },
      extra: { apiError: error.value, httpStatus: error.status },
    });
    throw err;
  }
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
