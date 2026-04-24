import { useQuery } from '@tanstack/react-query';
import { rpcClient } from 'expo-app/lib/api/rpcClient';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';
// API function
export const getCatalogItem = async (id: string) => {
  const res = await rpcClient.api.catalog[':id'].$get({
    param: { id: String(id) },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch catalog item: ${res.status}`);
  }
  return res.json();
};

// Hook
export function useCatalogItemDetails(id: string) {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  return useQuery({
    queryKey: ['catalogItem', id],
    queryFn: () => getCatalogItem(id),
    enabled: isQueryEnabledWithAccessToken && !!id,
  });
}
