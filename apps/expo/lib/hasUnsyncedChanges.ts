import {
  packTemplateItemsSyncState,
  packTemplatesSyncState,
} from 'expo-app/features/pack-templates/store';
import { packItemsSyncState, packsSyncState } from 'expo-app/features/packs/store';
import { packWeigthHistorySyncState } from 'expo-app/features/packs/store/packWeightHistory';
import { tripsSyncState } from 'expo-app/features/trips/store/trips';

const isEmpty = (obj: Record<string, unknown> = {}): boolean => Object.keys(obj).length === 0;

export function hasUnsyncedChanges() {
  return (
    isEmpty(packItemsSyncState.getPendingChanges()) ||
    isEmpty(packsSyncState.getPendingChanges()) ||
    isEmpty(packWeigthHistorySyncState.getPendingChanges()) ||
    isEmpty(packTemplatesSyncState.getPendingChanges()) ||
    isEmpty(packTemplateItemsSyncState.getPendingChanges()) ||
    isEmpty(tripsSyncState.getPendingChanges())
  );
}
