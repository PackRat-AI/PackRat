import { useQuery } from '@tanstack/react-query';
import { apiClient } from 'expo-app/lib/api/packrat';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';

export const fetchAllPacks = async () => {
  const { data, error } = await apiClient.packs.get({ query: { includePublic: 0 } });
  if (error) throw new Error(`Failed to fetch all packs: ${error.value}`);
  return data ?? [];
};

export function useAllPacks(enabled: boolean) {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  return useQuery({
    queryKey: ['allPacks'],
    enabled: isQueryEnabledWithAccessToken && enabled,
    queryFn: fetchAllPacks,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}
