import type { ApiClient } from '../../shared/api';

export const getTrips = (client: ApiClient) => client.trips.get();

export const getTrip = (client: ApiClient, tripId: string) => client.trips({ tripId }).get();

export const createTrip = (
  client: ApiClient,
  body: {
    id: string;
    name: string;
    description?: string | null;
    notes?: string | null;
    location?: { latitude: number; longitude: number; name?: string } | null;
    startDate?: string | null;
    endDate?: string | null;
    packId?: string | null;
    localCreatedAt: string;
    localUpdatedAt: string;
  },
) => client.trips.post(body);

export const updateTrip = (
  client: ApiClient,
  {
    tripId,
    body,
  }: {
    tripId: string;
    body: {
      name?: string;
      description?: string | null;
      notes?: string | null;
      location?: { latitude: number; longitude: number; name?: string } | null;
      startDate?: string | null;
      endDate?: string | null;
      packId?: string | null;
      localUpdatedAt?: string;
    };
  },
) => client.trips({ tripId }).put(body);

export const deleteTrip = (client: ApiClient, tripId: string) => client.trips({ tripId }).delete();
