import type { Observable, ObservableSyncState } from '@legendapp/state';
import { userSyncState } from 'app/features/auth/store';
import {
  packTemplateItemsSyncState,
  packTemplatesSyncState,
} from 'app/features/pack-templates/store';
import { packItemsSyncState, packsSyncState } from 'app/features/packs/store';
import { packWeigthHistorySyncState } from 'app/features/packs/store/packWeightHistory';
import { tripsSyncState } from 'app/features/trips/store/trips';

const hasPendingChanges = (syncState: Observable<ObservableSyncState>): boolean =>
  Object.keys(syncState.getPendingChanges() || {}).length !== 0;

export function hasUnsyncedChanges() {
  return (
    hasPendingChanges(userSyncState) ||
    hasPendingChanges(packItemsSyncState) ||
    hasPendingChanges(packsSyncState) ||
    hasPendingChanges(packWeigthHistorySyncState) ||
    hasPendingChanges(packTemplatesSyncState) ||
    hasPendingChanges(packTemplateItemsSyncState) ||
    hasPendingChanges(tripsSyncState)
  );
}
