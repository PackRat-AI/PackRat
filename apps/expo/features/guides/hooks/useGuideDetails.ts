import * as Sentry from '@sentry/react-native';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';

export const useGuideDetails = (id: string) => {
  return useQuery({
    queryKey: ['guide', id],
    queryFn: async () => {
      const { data, error } = await apiClient.guides({ id }).get();
      if (error) {
        const err = new Error(String(error.value ?? 'Failed to fetch guide'));
        Sentry.captureException(err, {
          tags: { feature: 'guides', action: 'fetchGuideDetails' },
          extra: { id, apiError: error.value, httpStatus: error.status },
        });
        throw err;
      }
      return data;
    },
    enabled: !!id,
  });
};
