import { PackItemSchema } from '@packrat/api/schemas/packs';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';
import type { PackItem } from '../types';

export async function fetchPackItemById(id: string) {
  const { data, error } = await apiClient.packs.items({ itemId: id }).get();
  if (error) throw new Error(`Failed to fetch pack item: ${error.value}`);
  return PackItemSchema.parse(data) as unknown as PackItem;
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
