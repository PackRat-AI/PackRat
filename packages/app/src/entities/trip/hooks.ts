import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '../../shared/api';
import { queryKeys } from '../../shared/api/query-keys';

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
