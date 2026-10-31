import * as Sentry from '@sentry/react-native';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';

/** Category slugs as the API returns them; labels come from `guideCategoryLabel`. */
export const useGuideCategories = () => {
  return useQuery({
    queryKey: ['guide-categories'],
    queryFn: async () => {
      const { data, error } = await apiClient.guides.categories.get();
      if (error) {
        const err = new Error(String(error.value ?? 'Failed to fetch guide categories'));
        Sentry.captureException(err, {
          tags: { feature: 'guides', action: 'fetchGuideCategories' },
          extra: { apiError: error.value, httpStatus: error.status },
        });
        throw err;
      }
      return data?.categories ?? [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false,
  });
};
