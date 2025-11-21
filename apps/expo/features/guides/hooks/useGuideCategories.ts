import { useQuery } from '@tanstack/react-query';
import axiosInstance from 'expo-app/lib/api/client';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';

interface CategoriesResponse {
  categories: string[];
  count: number;
}

export const useGuideCategories = () => {
  const { t } = useTranslation();

  return useQuery({
    queryKey: ['guide-categories'],
    queryFn: async () => {
      const response = await axiosInstance.get<CategoriesResponse>('/api/guides/categories');

      return [
        t('guides.all'),
        ...(response.data?.categories.map((category: string) =>
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
