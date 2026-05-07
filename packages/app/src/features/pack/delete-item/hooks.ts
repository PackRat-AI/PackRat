import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../../../shared/api';
import { queryKeys } from '../../../shared/api/query-keys';

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
