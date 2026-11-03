import { observable, syncState } from '@legendapp/state';
import { syncObservable } from '@legendapp/state/sync';
import * as Sentry from '@sentry/react-native';
import { persistPlugin } from 'expo-app/lib/persist-plugin';
import { nanoid } from 'nanoid';
import { performOperation, SafetyApiError } from '../lib/safetyApi';
import type { SafetyLocationFix } from '../types';
import {
  confirmStart,
  dropRefused,
  EMPTY_SAFETY_STATE,
  isRetryable,
  recordTrackPoints,
  type SafetyState,
} from '../utils/safetyQueue';

/**
 * Emergency contacts, active check-ins and the queue of writes waiting for signal, persisted on
 * the device so a check-in survives the app being killed on the trail.
 */
export const safetyStore = observable<SafetyState>({ ...EMPTY_SAFETY_STATE });

syncObservable(safetyStore, {
  persist: { plugin: persistPlugin, name: 'safetyCheckIn' },
});

export const safetySyncState = syncState(safetyStore);

/**
 * True while queued writes are held back because the last send couldn't reach the server. The
 * card only mentions waiting updates then, so a queue that is draining normally stays quiet.
 */
export const safetySendBlocked = observable(false);

/** Applies a pure transition from `utils/safetyQueue`. */
export function updateSafety(transition: (state: SafetyState) => SafetyState): void {
  safetyStore.set(transition(safetyStore.peek()));
}

/** Queues background positions for every check-in that allowed tracking, then tries to send. */
export function addTrackPoints(fixes: readonly SafetyLocationFix[]): void {
  updateSafety((state) => recordTrackPoints({ state, fixes, makeId: nanoid }));
  void flushSafetyQueue();
}

let flushing: Promise<void> | null = null;

/** How long one queued write may take before the run gives up and waits for the next retry. */
const SEND_TIMEOUT_MS = 30_000;

/**
 * A request on a dropping connection can stay pending forever, and every later flush shares the
 * run it is stuck in, so the queue would never drain. Timing out counts as no signal: the write
 * stays queued and is sent again on the next retry.
 */
function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new SafetyApiError('Request timed out', null)),
      SEND_TIMEOUT_MS,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Replays queued writes in order. Stops at the first that fails for lack of signal so later
 * writes can't overtake it; a write the server refuses outright is dropped so it can't block the
 * queue forever. Concurrent calls share one run.
 */
export function flushSafetyQueue(): Promise<void> {
  flushing ??= drain().finally(() => {
    flushing = null;
  });
  return flushing;
}

async function drain(): Promise<void> {
  for (;;) {
    const operation = safetyStore.queue.peek()[0];
    if (!operation) {
      safetySendBlocked.set(false);
      return;
    }
    try {
      const remote = await withTimeout(performOperation(operation));
      safetySendBlocked.set(false);
      updateSafety((state) => {
        // Ending a check-in can prune queued track points mid-send, so remove the operation
        // just sent by value rather than assuming it is still at the head.
        const sent = JSON.stringify(operation);
        const index = state.queue.findIndex((op) => JSON.stringify(op) === sent);
        const next =
          index === -1 ? state : { ...state, queue: state.queue.filter((_, i) => i !== index) };
        return operation.kind === 'start' && remote
          ? confirmStart({ state: next, tripId: operation.tripId, remote })
          : next;
      });
    } catch (error) {
      const httpStatus = error instanceof SafetyApiError ? error.httpStatus : null;
      if (isRetryable(httpStatus)) {
        safetySendBlocked.set(true);
        return;
      }
      Sentry.captureException(error, {
        tags: { feature: 'safetyCheckIn', action: `flush.${operation.kind}` },
        extra: { checkInId: operation.checkInId, httpStatus },
      });
      updateSafety((state) =>
        dropRefused({
          state,
          errorMessage: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}
