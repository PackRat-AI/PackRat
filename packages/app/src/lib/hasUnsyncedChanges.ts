import type { Observable, ObservableSyncState } from '@legendapp/state';
import { userSyncState } from '@packrat/app/auth/store';
import {
  packTemplateItemsSyncState,
  packTemplatesSyncState,
} from '@packrat/app/pack-templates/store';
import { packItemsSyncState, packsSyncState } from '@packrat/app/packs/store';
import { packWeigthHistorySyncState } from '@packrat/app/packs/store/packWeightHistory';
import { tripsSyncState } from '@packrat/app/trips/store/trips';

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
