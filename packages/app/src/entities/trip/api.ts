import type { ApiClient } from '../../shared/api';

export async function fetchTrips(client: ApiClient) {
  const { data, error } = await client.trips.get();
  if (error) throw new Error('Failed to fetch trips');
  return data;
}

export async function fetchTrip(client: ApiClient, tripId: string) {
  const { data, error } = await client.trips({ tripId }).get();
  if (error) throw new Error('Failed to fetch trip');
  return data;
}
