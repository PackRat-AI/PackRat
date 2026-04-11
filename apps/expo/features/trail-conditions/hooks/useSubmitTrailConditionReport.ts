import { nanoid } from 'nanoid/non-secure';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  trailConditionReportsStore,
  trailConditionReportsSyncState,
} from '../store/trailConditionReports';
import type { TrailConditionReportInput, TrailConditionReportInStore } from '../types';

interface SubmitOptions {
  onSuccess?: (id: string) => void;
  onError?: (error: Error) => void;
}

interface SubmitResult {
  /**
   * Write a new report to the local store and wait for the backend sync to
   * drain. Resolves with the created id on success and rejects with the sync
   * error on failure. While the network POST is in flight, `isPending` is
   * `true` so callers can disable submit buttons.
   */
  submit: (input: TrailConditionReportInput, options?: SubmitOptions) => Promise<string>;
  isPending: boolean;
  error: Error | null;
  reset: () => void;
}

/**
 * How long we wait for the sync plugin to drain a pending set before we
 * consider the submission "queued for later" and return control to the UI.
 * Long enough to catch typical server responses, short enough to avoid
 * leaving the submit button disabled forever on a slow/offline network — the
 * crud plugin will keep retrying in the background either way.
 */
const SYNC_DRAIN_TIMEOUT_MS = 8000;

type SyncDrainResult = 'drained' | 'queued';

/**
 * Wait until the trail condition reports sync state has no outstanding sets.
 * Resolves with:
 *   - 'drained' when the sync plugin successfully finishes the POST
 *   - 'queued'  when the timeout elapses before it drains (offline / retrying)
 * Rejects if the sync plugin surfaces an error during the wait window.
 */
function waitForSyncDrain(signal: { cancelled: boolean }): Promise<SyncDrainResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    // Use an object wrapper so `cleanup` (declared before the timer is armed)
    // can clear the timer once it has been assigned.
    const timer: { id: ReturnType<typeof setTimeout> | null } = { id: null };

    const cleanup = () => {
      if (timer.id != null) clearTimeout(timer.id);
      dispose();
    };

    const checkState = (): boolean => {
      if (signal.cancelled) {
        settled = true;
        cleanup();
        resolve('queued');
        return true;
      }
      const state = trailConditionReportsSyncState.get();
      if (state.error) {
        settled = true;
        cleanup();
        reject(state.error);
        return true;
      }
      const pending = state.numPendingSets ?? 0;
      if (!state.isSetting && pending === 0) {
        settled = true;
        cleanup();
        resolve('drained');
        return true;
      }
      return false;
    };

    const dispose = trailConditionReportsSyncState.onChange(() => {
      if (settled) return;
      checkState();
    });

    // Run the predicate once synchronously in case the sync already drained
    // before we attached the listener.
    if (checkState()) return;

    timer.id = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve('queued');
    }, SYNC_DRAIN_TIMEOUT_MS);
  });
}

export function useSubmitTrailConditionReport(): SubmitResult {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  const cancelRef = useRef<{ cancelled: boolean } | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (cancelRef.current) {
        cancelRef.current.cancelled = true;
      }
    };
  }, []);

  const submit = useCallback(
    async (reportData: TrailConditionReportInput, options?: SubmitOptions): Promise<string> => {
      const id = `tcr_${nanoid()}`;
      const timestamp = new Date().toISOString();

      const newReport: TrailConditionReportInStore = {
        id,
        ...reportData,
        deleted: false,
        localCreatedAt: timestamp,
        localUpdatedAt: timestamp,
      };

      setIsPending(true);
      setError(null);

      // Fresh cancel signal per submission so unmount / next submit can bail
      // out of the previous wait cleanly.
      const signal = { cancelled: false };
      if (cancelRef.current) cancelRef.current.cancelled = true;
      cancelRef.current = signal;

      // @ts-expect-error: Safe because Legend-State uses Proxy
      trailConditionReportsStore[id].set(newReport);

      // Yield a microtask so Legend-State finishes marking this change as a
      // pending set before we sample the sync state. Without this, the
      // initial snapshot could read numPendingSets === 0 and resolve before
      // the crud plugin has even scheduled the POST.
      await Promise.resolve();

      try {
        // 'drained' = server confirmed, 'queued' = crud plugin will keep
        // retrying in the background (e.g. offline). Both are success from
        // the user's perspective — their data is safely persisted locally.
        await waitForSyncDrain(signal);
        if (!mountedRef.current || signal.cancelled) return id;
        setIsPending(false);
        options?.onSuccess?.(id);
        return id;
      } catch (err) {
        const asError = err instanceof Error ? err : new Error(String(err));
        if (mountedRef.current && !signal.cancelled) {
          setError(asError);
          setIsPending(false);
          options?.onError?.(asError);
        }
        throw asError;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setIsPending(false);
    setError(null);
  }, []);

  return { submit, isPending, error, reset };
}
