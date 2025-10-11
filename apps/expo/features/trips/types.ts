import type { Pack } from 'expo-app/features/packs/types';

export type TripStatus = 'planned' | 'ongoing' | 'completed' | 'cancelled';

export interface Trip {
  id: string;
  name: string;
  description?: string;

  // ✅ Structured location instead of string
  location?: {
    latitude: number;
    longitude: number;
    name?: string; // optional friendly name (e.g., "Goa Beach" or reverse-geocoded label)
  };

  startDate?: string;
  endDate?: string;
  userId?: number;
  packId?: Pack['id'];
  deleted: boolean;
  createdAt?: string;
  updatedAt?: string;
  localCreatedAt?: string;
  localUpdatedAt?: string;
}

export type TripInStore = Omit<Trip, 'trips'>;

export type TripInput = Omit<
  TripInStore,
  | 'id'
  | 'userId'
  | 'deleted'
  | 'createdAt'
  | 'updatedAt'
  | 'localCreatedAt'
  | 'localUpdatedAt'
>;
