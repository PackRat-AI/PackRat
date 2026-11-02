import { useQueryClient } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { flushReportOutbox } from '../store/reportOutbox';
import { trailConditionsQueryKey } from './useTrailConditions';

/**
 * Sends reports written without signal as soon as there is some: on launch, when the app comes
 * back to the foreground, and when the connection returns. Mirrors the Swift `OutboxService`
 * replaying on reconnect, so a report doesn't wait for the hiker to reopen the feed.
 */
export function useReportOutboxSync({ isAuthed }: { isAuthed: boolean }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthed) return;

    const flush = async () => {
      const sent = await flushReportOutbox();
      if (sent > 0) queryClient.invalidateQueries({ queryKey: trailConditionsQueryKey });
    };

    flush();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') flush();
    });
    const network = Network.addNetworkStateListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) flush();
    });
    return () => {
      appState.remove();
      network.remove();
    };
  }, [isAuthed, queryClient]);
}
