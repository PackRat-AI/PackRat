import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../../../shared/api';
import { queryKeys } from '../../../shared/api/query-keys';

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
