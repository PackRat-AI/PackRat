import { isPresent } from '@packrat/guards';
import type { SafetyCheckIn } from '@packrat/schemas/safetyCheckIn';
import type {
  EmergencyContact,
  IdentifyingGearItem,
  LocalSafetyCheckIn,
  PendingSafetyOperation,
  SafetyCheckInOutcome,
  SafetyLocationFix,
} from '../types';
import { cleanGear, contactsNotified } from './safetyCheckIn';

/**
 * Everything the safety check-in keeps on the phone. Check-ins are local-first: starting one,
 * checking in, extending and I'm Safe all take effect here at once and queue a write, and the
 * queue is replayed in order whenever there is signal. That is what lets a user with no coverage
 * check in or mark themselves safe and have it reach their contacts once they're back in range.
 *
 * Every function here is a pure transition over this state; the store applies them.
 */
export interface SafetyState {
  contacts: EmergencyContact[];
  /** Active check-ins keyed by trip id. */
  active: Record<string, LocalSafetyCheckIn>;
  queue: PendingSafetyOperation[];
}

export const EMPTY_SAFETY_STATE: SafetyState = Object.freeze({
  contacts: [],
  active: {},
  queue: [],
});

function withoutTrip({
  active,
  tripId,
}: {
  active: SafetyState['active'];
  tripId: string;
}): SafetyState['active'] {
  const { [tripId]: _removed, ...rest } = active;
  return rest;
}

export function startCheckIn({
  state,
  id,
  tripId,
  tripName,
  contacts,
  expectedReturnAt,
  graceMinutes,
  gear,
  trackingEnabled,
  now,
  timeZone,
}: {
  state: SafetyState;
  id: string;
  tripId: string;
  tripName: string;
  contacts: readonly EmergencyContact[];
  expectedReturnAt: Date;
  graceMinutes: number;
  gear: readonly IdentifyingGearItem[];
  trackingEnabled: boolean;
  now: Date;
  timeZone: string;
}): { state: SafetyState; checkIn: LocalSafetyCheckIn } {
  const checkIn: LocalSafetyCheckIn = {
    id,
    tripId,
    tripName,
    contactNames: contacts.map((c) => c.name),
    expectedReturnAt: expectedReturnAt.toISOString(),
    graceMinutes,
    trackingEnabled,
    startedAt: now.toISOString(),
  };
  const operation: PendingSafetyOperation = {
    kind: 'start',
    tripId,
    checkInId: id,
    request: {
      id,
      contactIds: contacts.map((c) => c.id),
      expectedReturnAt: checkIn.expectedReturnAt,
      graceMinutes,
      identifyingGear: cleanGear(gear),
      trackingEnabled,
      startedAt: checkIn.startedAt,
      timeZone,
    },
  };
  return {
    state: {
      ...state,
      active: { ...state.active, [tripId]: checkIn },
      queue: [...state.queue, operation],
    },
    checkIn,
  };
}

/** A manual check-in where the user is standing, queued for the contacts. */
export function recordCheckIn({
  state,
  tripId,
  id,
  fix,
  note,
}: {
  state: SafetyState;
  tripId: string;
  id: string;
  fix: SafetyLocationFix;
  note?: string | null;
}): SafetyState {
  const checkIn = state.active[tripId];
  if (!checkIn) return state;
  const recordedAt = fix.recordedAt.toISOString();
  return {
    ...state,
    active: { ...state.active, [tripId]: { ...checkIn, lastCheckInAt: recordedAt } },
    queue: [
      ...state.queue,
      {
        kind: 'locations',
        checkInId: checkIn.id,
        locations: [
          {
            id,
            kind: 'check_in',
            latitude: fix.latitude,
            longitude: fix.longitude,
            accuracyMeters: fix.accuracy,
            placeName: fix.placeName?.trim() || null,
            note: note?.trim() || null,
            recordedAt,
          },
        ],
      },
    ],
  };
}

/** Background positions, queued for every check-in that allowed tracking. */
export function recordTrackPoints({
  state,
  fixes,
  makeId,
}: {
  state: SafetyState;
  fixes: readonly SafetyLocationFix[];
  makeId: () => string;
}): SafetyState {
  if (fixes.length === 0) return state;
  const added = Object.values(state.active)
    .filter((checkIn) => checkIn.trackingEnabled)
    .map(
      (checkIn): PendingSafetyOperation => ({
        kind: 'locations',
        checkInId: checkIn.id,
        locations: fixes.map((fix) => ({
          id: makeId(),
          kind: 'track',
          latitude: fix.latitude,
          longitude: fix.longitude,
          accuracyMeters: fix.accuracy,
          placeName: null,
          note: null,
          recordedAt: fix.recordedAt.toISOString(),
        })),
      }),
    );
  if (added.length === 0) return state;
  return { ...state, queue: [...state.queue, ...added] };
}

export function extendCheckIn({
  state,
  tripId,
  expectedReturnAt,
}: {
  state: SafetyState;
  tripId: string;
  expectedReturnAt: Date;
}): { state: SafetyState; checkIn: LocalSafetyCheckIn | null } {
  const current = state.active[tripId];
  if (!current) return { state, checkIn: null };
  const checkIn = { ...current, expectedReturnAt: expectedReturnAt.toISOString() };
  return {
    state: {
      ...state,
      active: { ...state.active, [tripId]: checkIn },
      queue: [
        ...state.queue,
        { kind: 'extend', checkInId: checkIn.id, expectedReturnAt: checkIn.expectedReturnAt },
      ],
    },
    checkIn,
  };
}

/**
 * I'm Safe (`safe`) or called off (`cancel`). The check-in leaves the phone at once and the server
 * hears about it as soon as there's signal. Unsent track points are dropped: the server deletes
 * every location when a check-in ends, so uploading them would only waste battery.
 */
export function endCheckIn({
  state,
  tripId,
  outcome,
  endedAt,
}: {
  state: SafetyState;
  tripId: string;
  outcome: SafetyCheckInOutcome;
  endedAt: Date;
}): { state: SafetyState; ended: LocalSafetyCheckIn | null } {
  const checkIn = state.active[tripId];
  if (!checkIn) return { state, ended: null };
  const active = withoutTrip({ active: state.active, tripId });
  const known = contactsNotified(checkIn) || state.queue.some((op) => op.checkInId === checkIn.id);
  if (!known) return { state: { ...state, active }, ended: checkIn };
  const queue = state.queue.filter(
    (op) =>
      !(
        op.kind === 'locations' &&
        op.checkInId === checkIn.id &&
        op.locations.every((location) => location.kind === 'track')
      ),
  );
  return {
    state: {
      ...state,
      active,
      queue: [
        ...queue,
        { kind: 'end', checkInId: checkIn.id, outcome, endedAt: endedAt.toISOString() },
      ],
    },
    ended: checkIn,
  };
}

/** Folds what the server knows into the local record. */
function applyRemote({
  local,
  remote,
}: {
  local: LocalSafetyCheckIn;
  remote: SafetyCheckIn;
}): LocalSafetyCheckIn {
  return {
    ...local,
    shareUrl: remote.shareUrl,
    contactNames: remote.contacts.map((c) => c.name),
    overdueAlertSent: remote.overdueAlertSentAt != null,
    startError: null,
  };
}

/** The server accepted the start: the contacts have been told. */
export function confirmStart({
  state,
  tripId,
  remote,
}: {
  state: SafetyState;
  tripId: string;
  remote: SafetyCheckIn;
}): SafetyState {
  const local = state.active[tripId];
  if (!local || local.id !== remote.id) return state;
  return { ...state, active: { ...state.active, [tripId]: applyRemote({ local, remote }) } };
}

/**
 * Brings a trip's check-in in line with the server, e.g. the overdue alert has gone out, or the
 * check-in was started or ended on another device. Skipped while this trip has writes queued, so
 * a stale read can never undo something the user just did. That includes a check-in just ended
 * here: it has left `active`, but its end is still queued under the id the server returns.
 */
export function reconcileRemote({
  state,
  tripId,
  tripName,
  remote,
}: {
  state: SafetyState;
  tripId: string;
  tripName: string;
  remote: SafetyCheckIn | null;
}): { state: SafetyState; removed: LocalSafetyCheckIn | null } {
  const local = state.active[tripId];
  const pendingIds = new Set([local?.id, remote?.id].filter(isPresent));
  if (state.queue.some((op) => pendingIds.has(op.checkInId))) {
    return { state, removed: null };
  }
  if (!remote) {
    // Ended elsewhere. Only drop it once the server had confirmed it existed.
    if (local && contactsNotified(local)) {
      return {
        state: { ...state, active: withoutTrip({ active: state.active, tripId }) },
        removed: local,
      };
    }
    return { state, removed: null };
  }
  const base: LocalSafetyCheckIn = local ?? {
    id: remote.id,
    tripId,
    tripName,
    contactNames: remote.contacts.map((c) => c.name),
    expectedReturnAt: remote.expectedReturnAt,
    graceMinutes: remote.graceMinutes,
    trackingEnabled: remote.trackingEnabled,
    startedAt: remote.startedAt,
  };
  return {
    state: {
      ...state,
      active: { ...state.active, [tripId]: applyRemote({ local: base, remote }) },
    },
    removed: null,
  };
}

/**
 * Whether a failed write should wait for signal and try again. Anything without an HTTP status is
 * a network failure, and a 401 means the session lapsed: the write is still wanted once the user
 * signs back in, and dropping an I'm Safe would let the overdue alert go out. Any other 4xx except
 * timeout and rate limit is a refusal that would fail forever.
 */
export function isRetryable(httpStatus: number | null | undefined): boolean {
  if (httpStatus == null) return true;
  return httpStatus === 401 || httpStatus === 408 || httpStatus === 429 || httpStatus >= 500;
}

/**
 * Drops the head of the queue after the server refused it outright, so it can't block every later
 * write. A refused start takes the rest of its check-in with it and is shown on the trip.
 */
export function dropRefused({
  state,
  errorMessage,
}: {
  state: SafetyState;
  errorMessage: string;
}): SafetyState {
  const [head, ...rest] = state.queue;
  if (!head) return state;
  if (head.kind !== 'start') return { ...state, queue: rest };
  const local = state.active[head.tripId];
  return {
    ...state,
    queue: rest.filter((op) => op.checkInId !== head.checkInId),
    active:
      local && local.id === head.checkInId
        ? { ...state.active, [head.tripId]: { ...local, startError: errorMessage } }
        : state.active,
  };
}

/** Writes for this trip's check-in still waiting for signal. */
export function pendingCount({ state, tripId }: { state: SafetyState; tripId: string }): number {
  const id = state.active[tripId]?.id;
  if (!id) return 0;
  return state.queue.filter((op) => op.checkInId === id).length;
}

export function hasTrackingCheckIn(state: Pick<SafetyState, 'active'>): boolean {
  return Object.values(state.active).some((checkIn) => checkIn.trackingEnabled);
}
