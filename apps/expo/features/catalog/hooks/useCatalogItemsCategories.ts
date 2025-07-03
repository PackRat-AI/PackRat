import { useQuery } from '@tanstack/react-query';
import axiosInstance, { handleApiError } from '~/lib/api/client';
import { useAuthenticatedQueryToolkit } from '~/lib/hooks/useAuthenticatedQueryToolkit';

const FALLBACK_CATEGORIES = [
  'Clothing',
  'Bike',
  'Footwear',
  'Accessories',
  'Kids',
  'Hike & Camp',
  'Ski',
  'Climb',
  'Snowboard',
  'Fishing',
];

const getCategories = async (): Promise<string[]> => {
  try {
    const response = await axiosInstance.get(`/api/catalog/categories`);
    const data = response.data;
    if (data.length > 0) return data;
    return FALLBACK_CATEGORIES;
  } catch (error) {
    const { message } = handleApiError(error);
    console.error(`Failed to fetch catalog categories: ${message}`);
    return FALLBACK_CATEGORIES;
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
