import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../../../shared/api';
import { queryKeys } from '../../../shared/api/query-keys';

interface UpdateTripBody {
  name?: string;
  description?: string | null;
  notes?: string | null;
  location?: { latitude: number; longitude: number; name?: string } | null;
  startDate?: string | null;
  endDate?: string | null;
  packId?: string | null;
  localUpdatedAt?: string;
}

export function useUpdateTripMutation() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tripId, body }: { tripId: string; body: UpdateTripBody }) => {
      const { data, error } = await client.trips({ tripId }).put(body);
      if (error) throw new Error('Failed to update trip');
      return data;
    },
    onSuccess: (_data, { tripId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.trips });
      qc.invalidateQueries({ queryKey: queryKeys.trip(tripId) });
    },
  });
}
