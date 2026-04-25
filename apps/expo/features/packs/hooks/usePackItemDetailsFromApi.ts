import { useQuery } from '@tanstack/react-query';
import type { PackItem } from 'expo-app/features/packs/types';
import { apiClient } from 'expo-app/lib/api/packrat';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';

export async function fetchPackItemById(id: string): Promise<PackItem> {
  const { data, error } = await apiClient.packs.items({ itemId: id }).get();
  if (error) throw new Error(`Failed to fetch pack item: ${error.value}`);
  return data as unknown as PackItem;
}

export function usePackItemDetailsFromApi({ id, enabled }: { id: string; enabled: boolean }) {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  const { data, ...rest } = useQuery({
    queryKey: ['pack', id],
    queryFn: () => fetchPackItemById(id),
    enabled: isQueryEnabledWithAccessToken && !!id && enabled,
  });

  return {
    item: data,
    ...rest,
  };
}
