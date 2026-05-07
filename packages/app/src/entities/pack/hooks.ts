import { useQuery } from '@tanstack/react-query';
import { queryKeys, useApiClient } from '../../shared/api';

export function usePacks() {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.packs(),
    queryFn: async () => {
      const { data, error } = await client.packs.get({ query: { includePublic: 0 } });
      if (error) throw new Error('Failed to fetch packs');
      return data;
    },
  });
}

export function usePack(packId: string) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.pack(packId),
    queryFn: async () => {
      const { data, error } = await client.packs({ packId }).get();
      if (error) throw new Error('Failed to fetch pack');
      return data;
    },
    enabled: !!packId,
  });
}
