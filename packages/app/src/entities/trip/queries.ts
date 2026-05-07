import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys, useApiClient } from '../../shared/api';

export function useTrips() {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.trips,
    queryFn: async () => {
      const { data, error } = await client.trips.get();
      if (error) throw new Error('Failed to fetch trips');
      return data;
    },
  });
}

export function useTrip(tripId: string) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.trip(tripId),
    queryFn: async () => {
      const { data, error } = await client.trips({ tripId }).get();
      if (error) throw new Error('Failed to fetch trip');
      return data;
    },
    enabled: !!tripId,
  });
}

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
