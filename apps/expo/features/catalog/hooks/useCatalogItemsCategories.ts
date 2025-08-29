import { useQuery } from '@tanstack/react-query';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';

const getCategories = async (): Promise<string[]> => {
  try {
    const response = await axiosInstance.get<string[]>(`/api/catalog/categories`);
    return response.data;
  } catch (error) {
    const { message } = handleApiError(error);
    console.error(`Failed to fetch catalog categories: ${message}`);
    throw error;
  }
};

export function useCatalogItemsCategories() {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  return useQuery({
    queryKey: ['catalogCategories'],
    queryFn: async () => {
      const cats = await getCategories();
      return ['All', ...cats];
    },
    staleTime: Infinity,
    gcTime: Infinity,
    enabled: isQueryEnabledWithAccessToken,
  });
}
