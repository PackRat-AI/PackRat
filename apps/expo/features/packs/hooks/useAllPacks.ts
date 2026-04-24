import { useQuery } from '@tanstack/react-query';
import { rpcClient } from 'expo-app/lib/api/rpcClient';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';

export const fetchAllPacks = async () => {
  const res = await rpcClient.api.packs.$get({
    query: {
      includePublic: 1,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch all packs: ${res.status}`);
  }
  return res.json();
};

export function useAllPacks(enabled: boolean) {
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  return useQuery({
    queryKey: ['allPacks'],
    enabled: isQueryEnabledWithAccessToken && enabled,
    queryFn: fetchAllPacks,
    staleTime: 1000 * 60 * 5, // 5 min
    refetchOnWindowFocus: false,
  });
}
