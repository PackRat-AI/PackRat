import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys, useApiClient } from '../../../shared/api';
import { generateId } from '../../../shared/lib/uuid';

interface CreateTripInput {
  name: string;
  description?: string | null;
  notes?: string | null;
  location?: { latitude: number; longitude: number; name?: string } | null;
  startDate?: string | null;
  endDate?: string | null;
  packId?: string | null;
}

export function useCreateTripMutation() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTripInput) => {
      const now = new Date().toISOString();
      const { data, error } = await client.trips.post({
        ...input,
        id: generateId(),
        localCreatedAt: now,
        localUpdatedAt: now,
      });
      if (error) throw new Error('Failed to create trip');
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.trips }),
  });
}
