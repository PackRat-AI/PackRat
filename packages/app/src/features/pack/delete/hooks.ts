import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../../../shared/api';
import { queryKeys } from '../../../shared/api/query-keys';

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
