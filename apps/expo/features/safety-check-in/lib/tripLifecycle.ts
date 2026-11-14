import { observable } from '@legendapp/state';
import type { TripStatus } from '@packrat/schemas/trips';
import { tripsStore } from 'expo-app/features/trips/store/trips';
import { obs } from 'expo-app/lib/store';

/**
 * True while starting a trip asks whether to notify emergency contacts, so other prompts on the
 * trip page wait their turn instead of opening on top of it.
 */
export const tripStartPromptOpen = observable(false);

/** Moves a trip through planned → in progress → complete, stamping when each happened. */
export function setTripLifecycle({ tripId, status }: { tripId: string; status: TripStatus }) {
  const trip = obs({ store: tripsStore, id: tripId });
  const current = trip.peek();
  if (!current) return;
  const now = new Date().toISOString();
  trip.set({
    ...current,
    status,
    startedAt: status === 'planned' ? null : status === 'in_progress' ? now : current.startedAt,
    completedAt: status === 'complete' ? now : null,
    localUpdatedAt: now,
  });
}
