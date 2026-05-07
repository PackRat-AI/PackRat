import type { ApiClient } from '../../shared/api';
import { TripSchema } from './schema';

export async function fetchTrips(client: ApiClient) {
  const { data, error } = await client.trips.get();
  if (error) throw new Error('Failed to fetch trips');
  return TripSchema.array().parse(data);
}

export async function fetchTrip(client: ApiClient, tripId: string) {
  const { data, error } = await client.trips({ tripId }).get();
  if (error) throw new Error('Failed to fetch trip');
  return TripSchema.parse(data);
}
