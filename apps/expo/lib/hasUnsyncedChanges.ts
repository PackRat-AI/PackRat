import type { Observable, ObservableSyncState } from '@legendapp/state';
import {
  packTemplateItemsSyncState,
  packTemplatesSyncState,
} from 'expo-app/features/pack-templates/store';
import { packItemsSyncState, packsSyncState } from 'expo-app/features/packs/store';
import { packWeigthHistorySyncState } from 'expo-app/features/packs/store/packWeightHistory';
import { tripsSyncState } from 'expo-app/features/trips/store/trips';

const hasPendingChanges = (syncState: Observable<ObservableSyncState>): boolean =>
  Object.keys(syncState.getPendingChanges() || {}).length !== 0;

export function hasUnsyncedChanges() {
  return (
    hasPendingChanges(packItemsSyncState) ||
    hasPendingChanges(packsSyncState) ||
    hasPendingChanges(packWeigthHistorySyncState) ||
    hasPendingChanges(packTemplatesSyncState) ||
    hasPendingChanges(packTemplateItemsSyncState) ||
    hasPendingChanges(tripsSyncState)
  );
}
