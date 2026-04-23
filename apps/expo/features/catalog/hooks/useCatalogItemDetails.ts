import { useQuery } from '@tanstack/react-query';
import { rpcClient } from 'expo-app/lib/api/rpcClient';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';
import type { CatalogItem } from '../types';

// API function
export const getCatalogItem = async (id: string): Promise<CatalogItem> => {
  const res = await rpcClient.api.catalog[':id'].$get({
    param: { id: String(id) },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch catalog item: ${res.status}`);
  }
  return res.json() as Promise<CatalogItem>;
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
