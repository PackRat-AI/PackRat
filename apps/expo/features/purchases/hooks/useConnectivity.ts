import * as Network from 'expo-network';
import { useEffect, useState } from 'react';

export type ConnectivityStatus = 'unknown' | 'online' | 'offline';

/**
 * Lightweight connectivity signal used by the early-access gate to tell a true
 * "you're offline, we can't verify your access" cold start apart from a real
 * "you're online and simply not subscribed" state. Uses `expo-network` (already
 * a dependency) rather than pulling in a new native module.
 *
 * Starts `unknown` and resolves to `online`/`offline` after the first probe, so
 * callers can wait for a definite answer before showing an offline message.
 */
export function useConnectivity(): ConnectivityStatus {
  const [status, setStatus] = useState<ConnectivityStatus>('unknown');

  useEffect(() => {
    let cancelled = false;

    const resolve = (state: Network.NetworkState | undefined) => {
      if (cancelled || !state) return;
      // `isInternetReachable` can be undefined on some platforms; fall back to
      // `isConnected`. Treat "reachable" as the stronger signal when present.
      const reachable = state.isInternetReachable ?? state.isConnected ?? false;
      setStatus(reachable ? 'online' : 'offline');
    };

    Network.getNetworkStateAsync()
      .then(resolve)
      .catch(() => {
        if (!cancelled) setStatus('offline');
      });

    const sub = Network.addNetworkStateListener(resolve);
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  return status;
}
