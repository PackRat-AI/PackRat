import * as Sentry from '@sentry/react-native';
import { nanoid } from 'nanoid';
import { flushSafetyQueue, safetyStore, updateSafety } from '../store/safetyCheckIn';
import type {
  EmergencyContact,
  IdentifyingGearItem,
  SafetyCheckInOutcome,
  SafetyLocationFix,
} from '../types';
import { upsertContact } from '../utils/safetyCheckIn';
import {
  EMPTY_SAFETY_STATE,
  endCheckIn,
  extendCheckIn,
  hasTrackingCheckIn,
  reconcileRemote,
  recordCheckIn,
  startCheckIn,
} from '../utils/safetyQueue';
import { startTracking, stopTracking } from './locationTracking';
import * as api from './safetyApi';
import {
  cancelAllSafetyNotifications,
  cancelSafetyNotifications,
  scheduleSafetyNotifications,
} from './safetyNotifications';

/** Ids the server accepts, generated here so a write replayed after a lost reply is idempotent. */
const newId = () => nanoid(24);

// ── Contacts ──────────────────────────────────────────────────────────────

/** Refreshes the contact list; offline, the cached list stays so a check-in can still start. */
export async function loadContacts(): Promise<void> {
  try {
    const contacts = await api.listContacts();
    safetyStore.contacts.set(contacts);
  } catch (error) {
    if (!(error instanceof api.SafetyApiError) || error.httpStatus != null) {
      Sentry.captureException(error, {
        tags: { feature: 'safetyCheckIn', action: 'loadContacts' },
      });
    }
  }
}

export async function saveContact({
  id,
  name,
  email,
  phone,
  isDefault,
}: {
  /** Absent for a new contact. */
  id?: string;
  name: string;
  email: string;
  phone: string | null;
  isDefault: boolean;
}): Promise<EmergencyContact> {
  Sentry.addBreadcrumb({
    category: 'safetyCheckIn',
    message: id ? 'Updating emergency contact' : 'Adding emergency contact',
    level: 'info',
  });
  try {
    const saved = id
      ? await api.updateContact({ id, request: { name, email, phone, isDefault } })
      : await api.createContact({
          id: newId(),
          name,
          email,
          phone,
          // The first contact is the default, so every trip has someone preselected.
          isDefault: isDefault || safetyStore.contacts.peek().length === 0,
        });
    safetyStore.contacts.set(upsertContact({ contacts: safetyStore.contacts.peek(), saved }));
    return saved;
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'safetyCheckIn', action: id ? 'updateContact' : 'addContact' },
      extra: { httpStatus: error instanceof api.SafetyApiError ? error.httpStatus : null },
    });
    throw error;
  }
}

export async function removeContact(id: string): Promise<void> {
  try {
    await api.deleteContact(id);
    safetyStore.contacts.set(safetyStore.contacts.peek().filter((c) => c.id !== id));
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'safetyCheckIn', action: 'deleteContact' },
      extra: { httpStatus: error instanceof api.SafetyApiError ? error.httpStatus : null },
    });
    throw error;
  }
}

// ── Check-in lifecycle ────────────────────────────────────────────────────

export function startSafetyCheckIn(input: {
  tripId: string;
  tripName: string;
  contacts: readonly EmergencyContact[];
  expectedReturnAt: Date;
  graceMinutes: number;
  gear: readonly IdentifyingGearItem[];
  trackingEnabled: boolean;
}): void {
  Sentry.addBreadcrumb({
    category: 'safetyCheckIn',
    message: 'Check-in started',
    level: 'info',
    data: { tripId: input.tripId, trackingEnabled: input.trackingEnabled },
  });
  const { state, checkIn } = startCheckIn({
    ...input,
    state: safetyStore.peek(),
    id: newId(),
    now: new Date(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  safetyStore.set(state);
  void scheduleSafetyNotifications(checkIn);
  if (input.trackingEnabled) void startTracking();
  void flushSafetyQueue();
}

export function recordSafetyCheckIn({
  tripId,
  fix,
  note,
}: {
  tripId: string;
  fix: SafetyLocationFix;
  note: string;
}): void {
  updateSafety((state) => recordCheckIn({ state, tripId, id: newId(), fix, note }));
  void flushSafetyQueue();
}

export function extendSafetyCheckIn({ tripId, to }: { tripId: string; to: Date }): void {
  const { state, checkIn } = extendCheckIn({
    state: safetyStore.peek(),
    tripId,
    expectedReturnAt: to,
  });
  safetyStore.set(state);
  if (checkIn) void scheduleSafetyNotifications(checkIn);
  void flushSafetyQueue();
}

/**
 * I'm Safe (`safe`) or called off (`cancel`). The check-in leaves the phone at once; the server
 * hears about it as soon as there's signal.
 */
export function endSafetyCheckIn({
  tripId,
  outcome,
}: {
  tripId: string;
  outcome: SafetyCheckInOutcome;
}): void {
  const { state, ended } = endCheckIn({
    state: safetyStore.peek(),
    tripId,
    outcome,
    endedAt: new Date(),
  });
  safetyStore.set(state);
  if (ended) void cancelSafetyNotifications(ended.id);
  if (!hasTrackingCheckIn(state)) void stopTracking();
  void flushSafetyQueue();
}

/**
 * Pulls the server's view of a trip's check-in, e.g. whether the overdue alert has gone out, or a
 * check-in started on another device. Quiet offline.
 */
export async function refreshSafetyCheckIn({
  tripId,
  tripName,
}: {
  tripId: string;
  tripName: string;
}): Promise<void> {
  await flushSafetyQueue();
  let remote: Awaited<ReturnType<typeof api.fetchActiveCheckIn>>;
  try {
    remote = await api.fetchActiveCheckIn(tripId);
  } catch {
    return;
  }
  const before = safetyStore.active.peek()[tripId];
  const { state, removed } = reconcileRemote({
    state: safetyStore.peek(),
    tripId,
    tripName,
    remote,
  });
  safetyStore.set(state);
  if (removed) void cancelSafetyNotifications(removed.id);
  const after = state.active[tripId];
  if (after && !before) {
    void scheduleSafetyNotifications(after);
    if (after.trackingEnabled) void startTracking();
  }
  if (!hasTrackingCheckIn(state)) void stopTracking();
}

/** Clears everything on sign-out. */
export async function resetSafetyCheckIn(): Promise<void> {
  safetyStore.set({ ...EMPTY_SAFETY_STATE });
  await Promise.all([stopTracking(), cancelAllSafetyNotifications()]);
}
