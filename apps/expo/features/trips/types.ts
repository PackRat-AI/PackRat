import type { Pack } from 'expo-app/features/packs/types';

export type TripStatus = 'planned' | 'ongoing' | 'completed' | 'cancelled';

export interface Trip {
  id: string;
  name: string;
  description?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  userId?: number;
  packs?: Pack[]; // Optional packs added to the trip
  deleted: boolean;
  createdAt?: string;
  updatedAt?: string;
  localCreatedAt?: string;
  localUpdatedAt?: string;
}


export type TripInStore = Omit<Trip, 'trips'>;

export type TripInput = Omit<
  TripInStore,
  'id' | 'userId' | 'deleted' | 'createdAt' | 'updatedAt' | 'localCreatedAt' | 'localUpdatedAt'
>;
