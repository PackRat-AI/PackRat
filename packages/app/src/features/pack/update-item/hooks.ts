import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../../../shared/api';
import { queryKeys } from '../../../shared/api/query-keys';

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
