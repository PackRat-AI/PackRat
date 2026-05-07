import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../../../shared/api';
import { queryKeys } from '../../../shared/api/query-keys';

export function useDeleteTripMutation() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string) => {
      const { data, error } = await client.trips({ tripId }).delete();
      if (error) throw new Error('Failed to delete trip');
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.trips }),
  });
}
