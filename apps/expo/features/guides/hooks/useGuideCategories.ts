import { useQuery } from '@tanstack/react-query';
import axiosInstance from 'expo-app/lib/api/client';

interface CategoriesResponse {
  categories: string[];
  count: number;
}

export const useGuideCategories = () => {
  return useQuery({
    queryKey: ['guide-categories'],
    queryFn: async () => {
      const response = await axiosInstance.get<CategoriesResponse>('/api/guides/categories');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
