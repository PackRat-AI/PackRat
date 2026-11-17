import type {
  EmergencyContact,
  IdentifyingGearItem,
  SafetyCheckInLocationInput,
  StartSafetyCheckInRequest,
} from '@packrat/schemas/safetyCheckIn';

export type { EmergencyContact, IdentifyingGearItem, SafetyCheckInLocationInput };

export type SafetyCheckInOutcome = 'safe' | 'cancel';

/**
 * A check-in as this phone knows it. Lives on the device from the moment the user taps Send, so
 * the countdown, Check In and I'm Safe all work before the server has heard of it.
 */
export interface LocalSafetyCheckIn {
  id: string;
  tripId: string;
  tripName: string;
  contactNames: string[];
  /** ISO timestamps, so the record survives a JSON round trip unchanged. */
  expectedReturnAt: string;
  graceMinutes: number;
  trackingEnabled: boolean;
  startedAt: string;
  /** Set once the server confirms the start, i.e. the contacts have been told. */
  shareUrl?: string | null;
  overdueAlertSent?: boolean;
  lastCheckInAt?: string | null;
  /** The server refused the start; nothing else for this check-in can land. */
  startError?: string | null;
}

/** A write waiting for signal. Replayed in order, oldest first. */
export type PendingSafetyOperation =
  | { kind: 'start'; tripId: string; checkInId: string; request: StartSafetyCheckInRequest }
  | { kind: 'extend'; checkInId: string; expectedReturnAt: string }
  | { kind: 'end'; checkInId: string; outcome: SafetyCheckInOutcome; endedAt: string }
  | { kind: 'locations'; checkInId: string; locations: SafetyCheckInLocationInput[] };

/** A position from the device, independent of the location module so the store stays testable. */
export interface SafetyLocationFix {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recordedAt: Date;
  placeName?: string | null;
}
