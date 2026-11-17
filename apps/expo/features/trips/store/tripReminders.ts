import { observable } from '@legendapp/state';
import { syncObservable } from '@legendapp/state/sync';
import { persistPlugin } from 'expo-app/lib/persist-plugin';
import { obs } from 'expo-app/lib/store';
import type { TripConditions } from '../utils/tripConditions';

/**
 * The user's two pre-trip reminder controls: the app-wide Trip Reminders
 * switch, and the trips whose reminders they turned off.
 *
 * Device-local, like the reminders themselves: they are local notifications
 * scheduled per device, and so is the packing state they're written from.
 */
export const tripReminderSettingsStore = observable<{
  /** On by default: the feature flag is the gate, this is the user's say. */
  enabled: boolean;
  mutedTripIds: Record<string, true>;
}>({ enabled: true, mutedTripIds: {} });

syncObservable(tripReminderSettingsStore, {
  persist: { plugin: persistPlugin, name: 'tripReminderSettings' },
});

export function setTripRemindersMuted({ tripId, muted }: { tripId: string; muted: boolean }) {
  const entry = obs({ store: tripReminderSettingsStore.mutedTripIds, id: tripId });
  if (muted) entry.set(true);
  else entry.delete();
}

/**
 * The last destination forecast per trip, kept so the readiness summary and
 * reminders still have "the latest the app has" with no signal.
 */
export const tripConditionsStore = observable<Record<string, TripConditions>>({});

syncObservable(tripConditionsStore, {
  persist: { plugin: persistPlugin, name: 'tripConditions' },
});
