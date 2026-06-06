import * as Sentry from '@sentry/react-native';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';

export const useGuideCategories = () => {
  const { t } = useTranslation();

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

      return [
        t('guides.all'),
        ...(data?.categories.map((category: string) =>
          category
            .split('-')
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' '),
        ) || []),
      ];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false,
  });
};
