import { useQuery } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';
import type { Pack } from 'expo-app/types';

const fetchPackById = async (id: string): Promise<Pack> => {
  const { data, error } = await apiClient.packs({ packId: id }).get();
  if (error) throw new Error(`Failed to fetch pack: ${error.value}`);
  return data as unknown as Pack;
};

export function usePackDetailsFromApi({ id, enabled }: { id: string; enabled: boolean }) {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  const { data, ...rest } = useQuery({
    queryKey: ['pack', id],
    queryFn: () => fetchPackById(id),
    enabled: isQueryEnabledWithAccessToken && !!id && enabled,
  });

  return {
    pack: data,
    ...rest,
  };
}
