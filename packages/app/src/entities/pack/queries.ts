import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

interface UpdatePackBody {
  name?: string;
  description?: string;
  category?: string;
  isPublic?: boolean;
  image?: string | null;
  tags?: string[];
  deleted?: boolean;
  localUpdatedAt?: string;
}

export function useUpdatePackMutation() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ packId, body }: { packId: string; body: UpdatePackBody }) => {
      const { data, error } = await client.packs({ packId }).put(body);
      if (error) throw new Error('Failed to update pack');
      return data;
    },
    onSuccess: (_data, { packId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.packs() });
      qc.invalidateQueries({ queryKey: queryKeys.pack(packId) });
    },
  });
}

export function useDeletePackMutation() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (packId: string) => {
      const { data, error } = await client.packs({ packId }).delete();
      if (error) throw new Error('Failed to delete pack');
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.packs() }),
  });
}

interface UpdatePackItemBody {
  name?: string;
  description?: string;
  weight?: number;
  weightUnit?: 'g' | 'oz' | 'kg' | 'lb';
  quantity?: number;
  category?: string;
  consumable?: boolean;
  worn?: boolean;
  image?: string | null;
  notes?: string | null;
  catalogItemId?: number | null;
  deleted?: boolean;
}

export function useUpdatePackItemMutation() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      itemId,
      packId: _packId,
      body,
    }: {
      itemId: string;
      packId: string;
      body: UpdatePackItemBody;
    }) => {
      const { data, error } = await client.packs.items({ itemId }).patch(body);
      if (error) throw new Error('Failed to update pack item');
      return data;
    },
    onSuccess: (_result, { packId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.pack(packId) });
    },
  });
}

export function useDeletePackItemMutation() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, packId: _packId }: { itemId: string; packId: string }) => {
      const { data, error } = await client.packs.items({ itemId }).delete();
      if (error) throw new Error('Failed to delete pack item');
      return data;
    },
    onSuccess: (_data, { packId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.pack(packId) });
    },
  });
}
