import { useQuery } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';

export const getCatalogItem = async (id: string) => {
  const { data, error } = await apiClient.catalog({ id }).get();
  if (error) throw new Error(`Failed to fetch catalog item: ${error.value}`);
  return data;
};

export function useCatalogItemDetails(id: string) {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  return useQuery({
    queryKey: ['catalogItem', id],
    queryFn: () => getCatalogItem(id),
    enabled: isQueryEnabledWithAccessToken && !!id,
  });
}
