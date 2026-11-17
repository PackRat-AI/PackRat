import type {
  TripChecklistItem,
  TripStatus as TripLifecycle,
  TripLog,
  TripPlannedRoute,
} from '@packrat/schemas/trips';
import type { Pack } from 'expo-app/features/packs/types';

export type TripStatus = 'planned' | 'ongoing' | 'completed' | 'cancelled';

export interface Trip {
  id: string;
  name: string;
  description?: string;
  notes?: string;

  // ✅ Structured location instead of string
  location?: {
    latitude: number;
    longitude: number;
    name?: string; // optional friendly name (e.g., "Goa Beach" or reverse-geocoded label)
  };

  startDate?: string;
  endDate?: string;
  userId?: string;
  packId?: Pack['id'];
  /** The trail the trip is on, from PackRat's trails. Its conditions show on the trip. */
  trailId?: string | null;
  trailName?: string | null;
  log?: TripLog | null;
  /** The trip's Before-you-go list: permits, passes and bookings. */
  checklist?: TripChecklistItem[] | null;
  excludedFromStats?: boolean;
  /** Planned until Start Trip, in progress on the trail, complete once home. */
  status?: TripLifecycle;
  startedAt?: string | null;
  completedAt?: string | null;
  /** The route the user means to follow, e.g. an imported GPX track. */
  plannedRoute?: TripPlannedRoute | null;
  deleted: boolean;
  createdAt?: string;
  updatedAt?: string;
  localCreatedAt?: string;
  localUpdatedAt?: string;
}

export type TripInStore = Trip;

export type TripInput = Omit<
  TripInStore,
  'id' | 'userId' | 'deleted' | 'createdAt' | 'updatedAt' | 'localCreatedAt' | 'localUpdatedAt'
>;
