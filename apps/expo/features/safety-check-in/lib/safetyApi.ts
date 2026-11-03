import { isNumber, isObject, isString } from '@packrat/guards';
import type {
  CreateEmergencyContactRequest,
  EmergencyContact,
  SafetyCheckIn,
  UpdateEmergencyContactRequest,
} from '@packrat/schemas/safetyCheckIn';
import { apiClient } from 'expo-app/lib/api/packrat';
import type { PendingSafetyOperation } from '../types';

/** A failed safety call, carrying the HTTP status so the queue can tell refusal from no signal. */
export class SafetyApiError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number | null,
  ) {
    super(message);
    this.name = 'SafetyApiError';
  }
}

/** The server's `{ error }` message when it sent one, else a fallback. */
function messageOf(value: unknown, fallback: string): string {
  const error = isObject(value) && 'error' in value ? value.error : undefined;
  return isString(error) ? error : fallback;
}

function unwrap<T>(
  result: { data: T | null; error: { status: unknown; value: unknown } | null },
  fallback: string,
): T {
  if (result.error || result.data == null) {
    const status = isNumber(result.error?.status) ? result.error.status : null;
    throw new SafetyApiError(messageOf(result.error?.value, fallback), status);
  }
  return result.data;
}

export async function listContacts(): Promise<EmergencyContact[]> {
  return unwrap(await apiClient['emergency-contacts'].get(), 'Failed to load emergency contacts');
}

export async function createContact(
  request: CreateEmergencyContactRequest,
): Promise<EmergencyContact> {
  return unwrap(
    await apiClient['emergency-contacts'].post(request),
    'Failed to add emergency contact',
  );
}

export async function updateContact({
  id,
  request,
}: {
  id: string;
  request: UpdateEmergencyContactRequest;
}): Promise<EmergencyContact> {
  return unwrap(
    await apiClient['emergency-contacts']({ id }).put(request),
    'Failed to update emergency contact',
  );
}

export async function deleteContact(id: string): Promise<void> {
  unwrap(
    await apiClient['emergency-contacts']({ id }).delete(),
    'Failed to remove emergency contact',
  );
}

export async function fetchActiveCheckIn(tripId: string): Promise<SafetyCheckIn | null> {
  const body = unwrap(
    await apiClient.trips({ tripId })['check-in'].get(),
    'Failed to load safety check-in',
  );
  return body.checkIn;
}

/**
 * Sends one queued write. Returns the check-in the server answered with for a start, so the
 * store can record that the contacts were told.
 */
export async function performOperation(
  operation: PendingSafetyOperation,
): Promise<SafetyCheckIn | null> {
  switch (operation.kind) {
    case 'start':
      return unwrap(
        await apiClient.trips({ tripId: operation.tripId })['check-in'].post(operation.request),
        "Your contacts couldn't be notified.",
      );
    case 'extend':
      unwrap(
        await apiClient['safety-check-ins']({ id: operation.checkInId }).extend.post({
          expectedReturnAt: operation.expectedReturnAt,
        }),
        'Failed to update the return time',
      );
      return null;
    case 'end': {
      const route = apiClient['safety-check-ins']({ id: operation.checkInId });
      const body = { endedAt: operation.endedAt };
      unwrap(
        operation.outcome === 'safe' ? await route.safe.post(body) : await route.cancel.post(body),
        'Failed to end the check-in',
      );
      return null;
    }
    case 'locations':
      unwrap(
        await apiClient['safety-check-ins']({ id: operation.checkInId }).locations.post({
          locations: operation.locations,
        }),
        'Failed to send check-in',
      );
      return null;
  }
}
