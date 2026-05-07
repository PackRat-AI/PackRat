import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../../../shared/api';
import { queryKeys } from '../../../shared/api/query-keys';

interface AddPackItemInput {
  name: string;
  description?: string;
  weight: number;
  weightUnit?: 'g' | 'oz' | 'kg' | 'lb';
  quantity?: number;
  category?: string;
  consumable?: boolean;
  worn?: boolean;
  image?: string | null;
  notes?: string | null;
  catalogItemId?: number | null;
}

export function useAddPackItemMutation() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ packId, body }: { packId: string; body: AddPackItemInput }) => {
      const { data, error } = await client.packs({ packId }).items.post({
        ...body,
        id: crypto.randomUUID(),
        quantity: body.quantity ?? 1,
        consumable: body.consumable ?? false,
        worn: body.worn ?? false,
        weightUnit: body.weightUnit ?? 'g',
      });
      if (error) throw new Error('Failed to add item to pack');
      return data;
    },
    onSuccess: (_data, { packId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.pack(packId) });
    },
  });
}
