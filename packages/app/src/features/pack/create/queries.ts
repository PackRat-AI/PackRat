import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys, useApiClient } from '../../../shared/api';
import { generateId } from '../../../shared/lib/uuid';

interface CreatePackInput {
  name: string;
  description?: string;
  category?: string;
  isPublic?: boolean;
  image?: string | null;
  tags?: string[];
}

export function useCreatePackMutation() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePackInput) => {
      const now = new Date().toISOString();
      const { data, error } = await client.packs.post({
        ...input,
        id: generateId(),
        isPublic: input.isPublic ?? false,
        localCreatedAt: now,
        localUpdatedAt: now,
      });
      if (error) throw new Error('Failed to create pack');
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.packs() }),
  });
}
